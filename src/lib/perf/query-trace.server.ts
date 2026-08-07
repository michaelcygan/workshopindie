/**
 * Query tracing for server-side read paths (Wave 10).
 *
 * Wraps a Supabase client so that every query issued inside a trace records
 * its table, operation chain and duration. Used to measure Home's fan-out
 * before changing it — measurement first, then targeted reduction.
 *
 * Cost when disabled: one AsyncLocalStorage lookup per query. Cost when
 * enabled: a few dozen small objects per request.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export type QuerySample = {
  /** Table or view the query targeted. */
  table: string;
  /** Chained builder operations, e.g. `select.eq.order.limit`. */
  ops: string;
  /** Wall-clock duration in milliseconds. */
  ms: number;
  ok: boolean;
  /** Exact call key including filter values; used for duplicate detection only. */
  key: string;
};

export type SpanSample = {
  name: string;
  ms: number;
  ok: boolean;
};

export type Trace = {
  label: string;
  startedAt: number;
  queries: QuerySample[];
  spans: SpanSample[];
};

export type TraceSummary = {
  label: string;
  /** Total wall-clock time of the traced operation. */
  totalMs: number;
  /** Number of queries issued. */
  queryCount: number;
  /** Sum of query durations (exceeds totalMs when queries run in parallel). */
  dbMs: number;
  /** Slowest queries, descending. */
  slowest: QuerySample[];
  /** Query signatures issued more than once in the same request. */
  duplicates: { signature: string; count: number; totalMs: number }[];
  /** Per-rail durations, descending. */
  spans: SpanSample[];
};

const storage = new AsyncLocalStorage<Trace>();

function now(): number {
  const perf = (globalThis as { performance?: { now(): number } }).performance;
  return perf ? perf.now() : Date.now();
}

/** Sampling rate, 0..1. `PERF_TRACE=1` forces every request to be traced. */
function sampleRate(): number {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  if (!env) return 0;
  if (env["PERF_TRACE"] === "1") return 1;
  if (env["PERF_TRACE"] === "0") return 0;
  const raw = Number(env["PERF_TRACE_SAMPLE"]);
  return Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : 0;
}

export function currentTrace(): Trace | null {
  return storage.getStore() ?? null;
}

function recordQuery(sample: QuerySample): void {
  const trace = storage.getStore();
  if (trace) trace.queries.push(sample);
}

function signature(q: QuerySample): string {
  return `${q.table}:${q.ops}`;
}

export function summarize(trace: Trace): TraceSummary {
  const totalMs = Math.round(now() - trace.startedAt);
  const dbMs = Math.round(trace.queries.reduce((sum, q) => sum + q.ms, 0));

  const bySignature = new Map<string, { count: number; totalMs: number; label: string }>();
  for (const q of trace.queries) {
    const entry = bySignature.get(q.key) ?? { count: 0, totalMs: 0, label: signature(q) };
    entry.count += 1;
    entry.totalMs += q.ms;
    bySignature.set(q.key, entry);
  }

  return {
    label: trace.label,
    totalMs,
    queryCount: trace.queries.length,
    dbMs,
    slowest: [...trace.queries]
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 8)
      .map((q) => ({ ...q, ms: Math.round(q.ms) })),
    duplicates: [...bySignature.entries()]
      .filter(([, v]) => v.count > 1)
      .map(([, v]) => ({ signature: v.label, count: v.count, totalMs: Math.round(v.totalMs) }))
      .sort((a, b) => b.count - a.count),
    spans: [...trace.spans]
      .sort((a, b) => b.ms - a.ms)
      .map((s) => ({ ...s, ms: Math.round(s.ms) })),
  };
}

/**
 * Run `fn` inside a trace. When sampling is off this is a direct call with no
 * added allocation. The summary is emitted as one structured log line.
 */
export async function withTrace<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (Math.random() >= sampleRate()) return fn();

  const trace: Trace = { label, startedAt: now(), queries: [], spans: [] };
  try {
    return await storage.run(trace, fn);
  } finally {
    const summary = summarize(trace);
    // Single structured line, no user content.
    console.log(`[perf] ${JSON.stringify(summary)}`);
  }
}

/** Time one named unit of work (a Home rail) inside the active trace. */
export async function span<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const trace = storage.getStore();
  if (!trace) return fn();
  const t0 = now();
  try {
    const value = await fn();
    trace.spans.push({ name, ms: now() - t0, ok: true });
    return value;
  } catch (err) {
    trace.spans.push({ name, ms: now() - t0, ok: false });
    throw err;
  }
}

function safeArgs(args: unknown[]): string {
  try {
    return JSON.stringify(args) ?? "";
  } catch {
    return "?";
  }
}

type Thenable = { then: (...args: unknown[]) => unknown };

function isThenable(value: unknown): value is Thenable {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/**
 * Proxy a PostgREST builder so awaiting it records a sample. Builder methods
 * mutate and return `this`, so identity results are re-wrapped to keep the
 * proxy alive across the chain.
 */
function wrapBuilder<T extends object>(
  builder: T,
  table: string,
  ops: string[],
  keyParts: string[],
): T {
  const proxy: T = new Proxy(builder, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (prop === "then" && typeof value === "function") {
        return (onOk?: unknown, onErr?: unknown) => {
          const t0 = now();
          const settled = (value as Thenable["then"]).call(
            target,
            (result: unknown) => {
              recordQuery({
                table,
                ops: ops.join("."),
                ms: now() - t0,
                ok: !(result as { error?: unknown } | null)?.error,
                key: `${table}|${keyParts.join("|")}`,
              });
              return result;
            },
            (err: unknown) => {
              recordQuery({
                table,
                ops: ops.join("."),
                ms: now() - t0,
                ok: false,
                key: `${table}|${keyParts.join("|")}`,
              });
              throw err;
            },
          ) as Promise<unknown>;
          return settled.then(onOk as never, onErr as never);
        };
      }

      if (typeof value === "function") {
        return (...args: unknown[]) => {
          const result = (value as (...a: unknown[]) => unknown).apply(target, args);
          const part = `${String(prop)}(${safeArgs(args)})`;
          if (result === target) {
            ops.push(String(prop));
            keyParts.push(part);
            return proxy;
          }
          if (typeof result === "object" && result !== null && isThenable(result)) {
            return wrapBuilder(
              result as object,
              table,
              [...ops, String(prop)],
              [...keyParts, part],
            );
          }
          return result;
        };
      }

      return value;
    },
  });
  return proxy;
}

/**
 * Wrap a Supabase client so its `.from()` queries are traced. Returns the same
 * type; when no trace is active the samples are simply dropped.
 */
export function traceClient<T extends { from: (table: string) => unknown }>(client: T): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === "from" && typeof value === "function") {
        return (table: string) => {
          const builder = (value as (t: string) => unknown).call(target, table);
          if (typeof builder !== "object" || builder === null) return builder;
          return wrapBuilder(builder as object, table, [], []);
        };
      }
      if (prop === "rpc" && typeof value === "function") {
        return (...args: unknown[]) => {
          const builder = (value as (...a: unknown[]) => unknown).apply(target, args);
          if (typeof builder !== "object" || builder === null) return builder;
          return wrapBuilder(
            builder as object,
            `rpc:${String(args[0])}`,
            [],
            [`args(${safeArgs(args.slice(1))})`],
          );
        };
      }
      return typeof value === "function" ? (value as () => unknown).bind(target) : value;
    },
  }) as T;
}
