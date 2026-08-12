import { ChevronDown, Check } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type CategoryTab<T extends string> = { id: T; label: string };

/**
 * Pill-bar of category chips. On mobile it renders as a single dropdown pill
 * (defaults to "All"). On desktop it renders as a wrapping pill row.
 */
export function CategoryScroller<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: CategoryTab<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    const current = tabs.find((t) => t.id === value);
    const label = current?.label ?? "All";
    return (
      <div className={cn("flex w-full", className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-ink shadow-soft hover:bg-muted"
              aria-label="Filter by category"
            >
              <span>{label}</span>
              <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="max-h-[60vh] w-56 overflow-y-auto">

            {tabs.map((t) => {
              const active = t.id === value;
              return (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => onChange(t.id)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className={cn(active && "font-medium text-ink")}>{t.label}</span>
                  {active && <Check className="h-3.5 w-3.5" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Desktop: single-line scroll rail that never wraps, plus an overflow menu
  // so every field stays one click away without growing the toolbar.
  const active = tabs.find((t) => t.id === value);
  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <div className="relative min-w-0 flex-1">
        <div className="flex gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1 shadow-soft [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[13px] transition select-none",
                value === t.id ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-full bg-gradient-to-l from-background to-transparent" />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1.5 text-xs text-ink-soft shadow-soft transition hover:bg-muted hover:text-ink"
            aria-label="All fields"
          >
            <span className="max-w-[9rem] truncate">
              {value === tabs[0]?.id ? "All fields" : (active?.label ?? "All fields")}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[60vh] w-60 overflow-y-auto">
          {tabs.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => onChange(t.id)}
              className="flex items-center justify-between gap-2"
            >
              <span className={cn(t.id === value && "font-medium text-ink")}>{t.label}</span>
              {t.id === value && <Check className="h-3.5 w-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

