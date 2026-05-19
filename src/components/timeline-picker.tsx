import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type TimelineMode = "asap" | "by_date" | "window" | "ongoing" | "flexible";

export type TimelineValue = {
  mode: TimelineMode;
  starts_on: string | null;
  ends_on: string | null;
};

const MODES: { id: TimelineMode; label: string; hint: string }[] = [
  { id: "asap", label: "ASAP", hint: "Starting now" },
  { id: "by_date", label: "By a date", hint: "Need someone by…" },
  { id: "window", label: "Window", hint: "Between two dates" },
  { id: "ongoing", label: "Ongoing", hint: "Open-ended" },
  { id: "flexible", label: "Flexible", hint: "Whenever" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function TimelinePicker({
  value,
  onChange,
}: {
  value: TimelineValue;
  onChange: (next: TimelineValue) => void;
}) {
  function setMode(mode: TimelineMode) {
    if (mode === "by_date") {
      onChange({ mode, starts_on: null, ends_on: value.ends_on ?? null });
    } else if (mode === "window") {
      onChange({ mode, starts_on: value.starts_on ?? todayISO(), ends_on: value.ends_on ?? null });
    } else {
      onChange({ mode, starts_on: null, ends_on: null });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition",
              value.mode === m.id
                ? "border-transparent bg-ink text-background"
                : "border-border bg-surface text-ink-soft hover:bg-muted",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {value.mode === "by_date" && (
        <div className="space-y-1.5">
          <Label htmlFor="tl-end">Need someone by</Label>
          <Input
            id="tl-end"
            type="date"
            min={todayISO()}
            value={value.ends_on ?? ""}
            onChange={(e) => onChange({ ...value, ends_on: e.target.value || null })}
          />
        </div>
      )}

      {value.mode === "window" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="tl-start">From</Label>
            <Input
              id="tl-start"
              type="date"
              min={todayISO()}
              value={value.starts_on ?? ""}
              onChange={(e) => onChange({ ...value, starts_on: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tl-end-w">To</Label>
            <Input
              id="tl-end-w"
              type="date"
              min={value.starts_on ?? todayISO()}
              value={value.ends_on ?? ""}
              onChange={(e) => onChange({ ...value, ends_on: e.target.value || null })}
            />
          </div>
        </div>
      )}

      {value.mode !== "by_date" && value.mode !== "window" && (
        <p className="text-xs text-ink-muted">
          {MODES.find((m) => m.id === value.mode)?.hint}
        </p>
      )}
    </div>
  );
}

export function timelineBadgeText(
  mode: TimelineMode,
  starts_on: string | null,
  ends_on: string | null,
): string | null {
  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  switch (mode) {
    case "asap":
      return "Starting now";
    case "by_date":
      return ends_on ? `By ${fmt(ends_on)}` : null;
    case "window":
      if (starts_on && ends_on) return `${fmt(starts_on)} – ${fmt(ends_on)}`;
      if (starts_on) return `From ${fmt(starts_on)}`;
      if (ends_on) return `Until ${fmt(ends_on)}`;
      return null;
    case "ongoing":
      return "Ongoing";
    case "flexible":
      return null;
  }
}
