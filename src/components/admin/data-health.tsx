import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminDataHealth } from "@/lib/admin-analytics.functions";
import { fmtNumber } from "@/lib/analytics";
import { Unavailable } from "./metric";

type Tone = "ok" | "warn" | "unknown";

function Row({ tone, label, detail }: { tone: Tone; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2 border-t border-border py-2 text-sm first:border-t-0">
      <span
        aria-hidden
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
          tone === "ok" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : "bg-ink-muted"
        }`}
      />
      <span className="text-ink">
        {label} <span className="text-ink-soft">{detail}</span>
      </span>
    </li>
  );
}

function pct(n: number | null, d: number | null): number | null {
  if (n == null || d == null || !d) return null;
  return (n / d) * 100;
}

/** Answers "can I trust these numbers?" before anyone acts on them. */
export function DataHealth({ compact }: { compact?: boolean }) {
  const fn = useServerFn(getAdminDataHealth);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "data-health"],
    queryFn: () => fn(),
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <div className="text-sm text-ink-muted">Checking data health…</div>;
  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <Unavailable />
      </div>
    );
  }

  const c = data.counts;
  const latest = data.latestActivityDay ? new Date(`${String(data.latestActivityDay).slice(0, 10)}T00:00:00Z`) : null;
  const staleDays = latest ? Math.floor((Date.now() - latest.getTime()) / 86400000) : null;
  const noCityPct = pct(c.noCity, c.members);
  const activatedPct = pct(c.activated, c.activationRows);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-2 flex items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-lg text-ink">Data health</h3>
          {compact ? null : <p className="text-xs text-ink-muted">Whether the numbers on the analytics pages can be trusted right now.</p>}
        </div>
        <span className="text-[11px] uppercase tracking-wider text-ink-muted">
          Checked {new Date(data.fetchedAt).toLocaleTimeString()}
        </span>
      </div>

      <ul>
        <Row
          tone={data.spineStatus === "unavailable" ? "unknown" : staleDays == null ? "warn" : staleDays <= 1 ? "ok" : "warn"}
          label="Activity spine"
          detail={
            data.spineStatus === "unavailable"
              ? "— the freshness query failed, so activity numbers cannot be trusted right now."
              : latest == null
                ? "— no activity has ever been recorded."
                : `is current through ${latest.toLocaleDateString()}${staleDays && staleDays > 1 ? ` (${staleDays} days behind today)` : " (today)"}.`
          }
        />
        <Row
          tone={data.kpiStatus === "unavailable" ? "unknown" : "ok"}
          label="Headline KPIs"
          detail={
            data.kpiStatus === "unavailable"
              ? "— the KPI view failed to load."
              : `computed ${data.kpiComputedAt ? new Date(data.kpiComputedAt).toLocaleString() : "on read"}, covering ${fmtNumber(data.kpiMembers ?? c.members ?? 0)} members.`
          }
        />
        <Row
          tone={c.excluded == null ? "unknown" : "ok"}
          label="Excluded accounts"
          detail={
            c.excluded == null
              ? "— count unavailable."
              : `${fmtNumber(c.excluded)} test/system account${c.excluded === 1 ? " is" : "s are"} held out of every analytics view.`
          }
        />
        <Row
          tone={noCityPct == null ? "unknown" : noCityPct > 40 ? "warn" : "ok"}
          label="Geography coverage"
          detail={
            noCityPct == null
              ? "— coverage unavailable."
              : `${fmtNumber(c.noCity ?? 0)} of ${fmtNumber(c.members ?? 0)} members (${noCityPct.toFixed(0)}%) have no home city, so they are missing from every map.`
          }
        />
        <Row
          tone={c.noUsername == null ? "unknown" : (c.noUsername ?? 0) > 0 ? "warn" : "ok"}
          label="Profile completeness"
          detail={
            c.noUsername == null
              ? "— count unavailable."
              : `${fmtNumber(c.noUsername)} profile${c.noUsername === 1 ? " has" : "s have"} no username; ${fmtNumber(c.softDeleted ?? 0)} account${c.softDeleted === 1 ? " is" : "s are"} soft-deleted.`
          }
        />
        <Row
          tone={activatedPct == null ? "unknown" : "ok"}
          label="Activation coverage"
          detail={
            activatedPct == null
              ? "— activation view unavailable."
              : `${fmtNumber(c.activated ?? 0)} of ${fmtNumber(c.activationRows ?? 0)} tracked signups (${activatedPct.toFixed(0)}%) have a first creative action.`
          }
        />
        <Row
          tone={c.subsSandbox == null ? "unknown" : (c.subsSandbox ?? 0) > 0 ? "warn" : "ok"}
          label="Subscriptions"
          detail={
            c.subsSandbox == null
              ? "— counts unavailable."
              : `${fmtNumber(c.subsLive ?? 0)} live, ${fmtNumber(c.subsSandbox)} sandbox. Only live rows reach revenue.`
          }
        />
      </ul>
    </div>
  );
}
