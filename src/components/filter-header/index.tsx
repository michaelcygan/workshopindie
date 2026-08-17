import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Workshop's shared sticky filter header.
 *
 * One primitive, many pages: the shell sticks under the site header (h-11 on
 * mobile, h-14 on desktop) with a blurred background and a hairline bottom
 * border. Each page composes its own controls inside it — search, selects,
 * segmented toggles, a clear button — so the chrome is identical while the
 * filters stay page-specific.
 */

export const FILTER_PILL =
  "h-10 shrink-0 rounded-full border border-border bg-surface px-3.5 text-[13px] text-ink-soft outline-none transition-colors hover:border-ink/40 focus:border-ink/50";

export const FILTER_ROW_SCROLL =
  "flex items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function FilterHeader({
  children,
  className,
  contentClassName,
  /** Set when the header sits inside an already-padded container. */
  inset = false,
  stack = false,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  inset?: boolean;
  stack?: boolean;
}) {
  return (
    <div
      className={cn(
        "sticky top-11 z-30 border-b border-border bg-background/80 backdrop-blur-md md:top-14",
        inset && "-mx-4 md:-mx-6",
        className,
      )}
    >
      <div
        className={cn(
          "relative mx-auto max-w-7xl px-4 py-2.5 md:px-6",
          stack ? "" : "flex flex-col gap-2 md:flex-row md:items-center md:justify-between",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Scrolling group for the right-hand controls. */
export function FilterControls({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(FILTER_ROW_SCROLL, className)}>{children}</div>;
}

/** Debounced live search field. */
export function FilterSearch({
  value,
  onChange,
  placeholder = "Search…",
  label = "Search",
  className,
  delay = 200,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  delay?: number;
}) {
  const [draft, setDraft] = React.useState(value);
  const dirty = React.useRef(false);

  React.useEffect(() => {
    if (!dirty.current) setDraft(value);
  }, [value]);

  React.useEffect(() => {
    if (!dirty.current) return;
    const id = window.setTimeout(() => {
      dirty.current = false;
      if (draft !== value) onChange(draft);
    }, delay);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <label
      className={cn(
        "flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3.5 md:max-w-sm",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
      <span className="sr-only">{label}</span>
      <input
        value={draft}
        onChange={(e) => {
          dirty.current = true;
          setDraft(e.target.value);
        }}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-muted/70 focus:outline-none"
      />
      {draft ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            dirty.current = true;
            setDraft("");
          }}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-muted hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </label>
  );
}

/** Dropdown pill used for Topic / Medium / City / Field / Sort. */
export function FilterSelect({
  label,
  value,
  onChange,
  children,
  className,
  width = "min-w-[13rem]",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  children: React.ReactNode;
  className?: string;
  width?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(FILTER_PILL, width, className)}
    >
      {children}
    </select>
  );
}

export type FilterToggleOption<T extends string> = {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
};

/** Segmented pill group (Upcoming/Past, Recent/Trending, tabs…). */
export function FilterToggleGroup<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  options: FilterToggleOption<T>[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-10 shrink-0 items-center gap-1 rounded-full border border-border bg-surface p-1",
        className,
      )}
      role="group"
    >
      {options.map((o) => {
        const Icon = o.icon;
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] transition",
              active ? "bg-ink text-background" : "text-ink-soft hover:bg-muted hover:text-ink",
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Single on/off pill (My RSVPs, Online only, Co-working…). */
export function FilterPillToggle({
  active,
  onClick,
  children,
  icon: Icon,
  label,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        FILTER_PILL,
        "inline-flex items-center gap-1.5 whitespace-nowrap",
        active && "border-transparent bg-ink text-background hover:border-transparent",
        className,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

/** Round X shown only when something is active. */
export function FilterClear({
  onClick,
  label = "Clear filters",
  className,
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-ink-muted transition-colors hover:border-ink/40 hover:text-ink",
        className,
      )}
    >
      <X className="h-4 w-4" />
    </button>
  );
}

/** Result-count line rendered under the header. */
export function FilterMeta({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("mx-auto max-w-7xl px-4 pt-3 text-sm text-ink-muted md:px-6", className)}>
      {children}
    </p>
  );
}
