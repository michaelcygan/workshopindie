/**
 * Structured operation logging (Wave 12).
 *
 * One line per server operation, emitted as single-line JSON prefixed with
 * `[op]` so it greps alongside the `[perf]` lines the query tracer emits.
 *
 * The point is that a capacity rejection and a genuine bug stop looking
 * identical in logs. A refused RSVP is `result: "FULL"` and expected; an
 * `UNHANDLED` line is a defect. Counting codes over a day answers "how often
 * are people bouncing off a full room" without any extra instrumentation.
 *
 * What is never logged: message bodies, titles, notes, emails, tokens, or any
 * other user-authored text. Entity ids and codes only.
 */

import { DomainError, type DomainErrorCode } from "@/lib/errors";

/** Result codes: the domain vocabulary plus the two outcomes it does not cover. */
export type OpResult = DomainErrorCode | "OK" | "UNHANDLED";

export type OpLog = {
  /** Dotted operation name, e.g. `rsvp.set` or `room.join`. */
  op: string;
  result: OpResult;
  ms: number;
  /** Entity the operation acted on, when there is a single obvious one. */
  entity?: string;
  entityId?: string;
  /** Whether a signed-in caller was present. Never the user id. */
  authed?: boolean;
  /** Small, non-identifying extras: a count, a status string from an RPC. */
  meta?: Record<string, string | number | boolean | null>;
};

function now(): number {
  const perf = (globalThis as { performance?: { now(): number } }).performance;
  return perf ? perf.now() : Date.now();
}

/** Classify a thrown value into a result code. */
export function resultCodeOf(error: unknown): OpResult {
  if (error instanceof DomainError) return error.code;
  return "UNHANDLED";
}

export function emitOpLog(entry: OpLog): void {
  const line: OpLog = { ...entry, ms: Math.round(entry.ms) };
  if (line.result === "UNHANDLED") console.error(`[op] ${JSON.stringify(line)}`);
  else console.log(`[op] ${JSON.stringify(line)}`);
}

type OpContext = {
  entity?: string;
  entityId?: string;
  authed?: boolean;
  meta?: Record<string, string | number | boolean | null>;
};

/**
 * Run `fn`, emitting exactly one log line for it.
 *
 * Errors are logged and re-thrown unchanged — this observes behaviour, it does
 * not alter it. The handler may enrich the line via the `ctx` argument (for an
 * id that is only known once the work has started).
 */
export async function withOpLog<T>(
  op: string,
  context: OpContext,
  fn: (ctx: OpContext) => Promise<T>,
): Promise<T> {
  const started = now();
  const ctx: OpContext = { ...context };
  try {
    const value = await fn(ctx);
    emitOpLog({ op, result: "OK", ms: now() - started, ...ctx });
    return value;
  } catch (error) {
    emitOpLog({ op, result: resultCodeOf(error), ms: now() - started, ...ctx });
    throw error;
  }
}
