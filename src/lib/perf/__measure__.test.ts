import { describe, it } from "vitest";
import { summarize, type Trace } from "./query-trace.server";

const RUNS = 5;

async function measure(label: string, fn: () => Promise<unknown>) {
  const mod = await import("./query-trace.server");
  const out: ReturnType<typeof summarize>[] = [];
  for (let i = 0; i < RUNS; i++) {
    process.env["PERF_TRACE"] = "1";
    const captured: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => {
      const s = String(a[0]);
      if (s.startsWith("[perf]")) captured.push(s.slice(7));
      else orig(...(a as []));
    };
    try {
      await mod.withTrace(label, fn);
    } finally {
      console.log = orig;
    }
    for (const c of captured) out.push(JSON.parse(c));
  }
  const totals = out.map((o) => o.totalMs).sort((a, b) => a - b);
  console.log(
    JSON.stringify(
      {
        label,
        runs: out.length,
        p50: totals[Math.floor(totals.length * 0.5)],
        p95: totals[Math.min(totals.length - 1, Math.floor(totals.length * 0.95))],
        max: totals[totals.length - 1],
        queryCount: out[0]?.queryCount,
        dbMs: out.map((o) => o.dbMs),
        slowest: out[0]?.slowest,
        duplicates: out[0]?.duplicates,
        spans: out[0]?.spans,
      },
      null,
      2,
    ),
  );
}

describe("home fan-out measurement", () => {
  it("public home", async () => {
    const { getPublicHomeServer } = await import("@/lib/home.server");
    const { invalidateCached } = await import("./ttl-cache.server");
    await measure("home.public", () => {
      invalidateCached("home:public");
      return getPublicHomeServer();
    });
    await measure("home.public.cached", () => getPublicHomeServer());
  }, 180_000);

  it("member home", async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .not("home_city_id", "is", null)
      .order("last_active_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const userId = (data as { id: string } | null)?.id;
    if (!userId) return;
    const { getMemberHomeServer } = await import("@/lib/home.server");
    await measure("home.member", () => getMemberHomeServer(userId));
  }, 180_000);
});

export type { Trace };
