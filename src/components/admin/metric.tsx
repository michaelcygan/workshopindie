import type { ReactNode } from "react";
import {
  delta,
  formatDelta,
  fmtNumber,
  formatRatio,
  ratio,
  type Panel,
} from "@/lib/analytics";

/* Shared admin analytics primitives: honest values, honest failures. */

export function Unavailable({ compact }: { compact?: boolean }) {
  return (
    <span className={`text-ink-muted ${compact ? "text-xs" : "text-sm"}`} title="An analytics query failed">
      Data unavailable
    </span>
  );
}

export function NotEnoughData({ label = "Not enough data" }: { label?: string }) {
  return <span className="text-sm text-ink-muted">{label}</span>;
}

export function UpdatedAt({ at }: { at?: string | null }) {
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  const rel = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  return (
    <span className="text-[11px] uppercase tracking-wider text-ink-muted" title={d.toLocaleString()}>
      Updated {rel}
    </span>
  );
}

export function SectionHeading({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-xl text-ink">{title}</h2>
        {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
      </div>
      {right}
    </div>
  );
}

type MetricProps = {
  label: string;
  value: number | string | null | undefined;
  /** Prior-period value; a delta is only rendered when this is provided. */
  prior?: number | null;
  periodLabel?: string;
  sublabel?: string;
  /** Tooltip: canonical definition of the metric. */
  definition?: string;
  status?: Panel<unknown>["status"];
  size?: "md" | "lg";
};

export function Metric({
  label,
  value,
  prior,
  periodLabel = "prior 30d",
  sublabel,
  definition,
  status = "ok",
  size = "md",
}: MetricProps) {
  const failed = status === "unavailable" || value === null || value === undefined;
  const d = typeof value === "number" && prior !== undefined && prior !== null ? delta(value, prior) : { kind: "none" as const };
  const deltaText = formatDelta(d, periodLabel);
  const up = d.kind !== "none" && d.abs > 0;
  const down = d.kind !== "none" && d.abs < 0;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-ink-muted">
        <span title={definition}>{label}</span>
        {definition ? <span className="cursor-help text-ink-muted/60" title={definition}>ⓘ</span> : null}
      </div>
      <div className={`mt-1 font-display text-ink ${size === "lg" ? "text-4xl" : "text-2xl"}`}>
        {failed ? <Unavailable /> : typeof value === "number" ? fmtNumber(value) : value}
      </div>
      {sublabel ? <div className="mt-0.5 text-xs text-ink-soft">{sublabel}</div> : null}
      {!failed && deltaText ? (
        <div className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
          <span aria-hidden className="text-ink-muted">{up ? "▲" : down ? "▼" : "•"}</span>
          <span>{deltaText}</span>
        </div>
      ) : null}
    </div>
  );
}

/** A percentage that always carries its denominator while the sample is small. */
export function RatioValue({
  numerator,
  denominator,
  unavailable,
  insufficientLabel = "Not enough data",
}: {
  numerator: number | null | undefined;
  denominator: number | null | undefined;
  unavailable?: boolean;
  insufficientLabel?: string;
}) {
  if (unavailable || numerator === null || numerator === undefined || denominator === null || denominator === undefined) {
    return <Unavailable compact />;
  }
  const r = ratio(numerator, denominator);
  if (r.kind === "insufficient") {
    return (
      <span className="text-ink-soft" title={insufficientLabel}>
        {formatRatio(r)}
      </span>
    );
  }
  return <span>{formatRatio(r)}</span>;
}

export function RatioMetric({
  label,
  numerator,
  denominator,
  definition,
  status = "ok",
}: {
  label: string;
  numerator: number | null | undefined;
  denominator: number | null | undefined;
  definition?: string;
  status?: Panel<unknown>["status"];
}) {
  const r = numerator !== null && numerator !== undefined && denominator ? ratio(numerator, denominator) : null;
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-ink-muted">
        <span title={definition}>{label}</span>
        {definition ? <span className="cursor-help text-ink-muted/60" title={definition}>ⓘ</span> : null}
      </div>
      <div className="mt-1 font-display text-2xl text-ink">
        {status === "unavailable" ? (
          <Unavailable />
        ) : r === null ? (
          <NotEnoughData />
        ) : r.kind === "insufficient" ? (
          <span className="text-xl text-ink-soft">{formatRatio(r)}</span>
        ) : (
          <>
            {r.pct.toFixed(r.pct < 10 ? 1 : 0)}%
            {r.showCounts ? (
              <span className="ml-2 align-middle text-sm text-ink-soft">
                {fmtNumber(r.numerator)} of {fmtNumber(r.denominator)}
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
