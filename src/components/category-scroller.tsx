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
      <div className={cn("inline-flex", className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-ink shadow-soft hover:bg-muted"
              aria-label="Filter by category"
            >
              <span>{label}</span>
              <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[60vh] w-48 overflow-y-auto">
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

  return (
    <div className={cn("flex flex-wrap gap-1 rounded-full border border-border bg-surface p-1 shadow-soft", className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-sm transition select-none",
            value === t.id ? "bg-ink text-background" : "text-ink-soft hover:bg-muted",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
