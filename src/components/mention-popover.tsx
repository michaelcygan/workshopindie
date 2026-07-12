import { useEffect, useMemo, useState } from "react";
import { Calendar, Megaphone, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  useEventSuggestions,
  useGroupSuggestions,
  useMyCollabSuggestions,
  useUserSuggestions,
  type MentionKind,
  type MentionSuggestion,
} from "@/lib/mention-suggestions";

/**
 * Shared `@` typeahead popover for chat surfaces.
 * Combines Users + Collabs + Groups + Events into a single grouped list
 * with keyboard navigation. Position is up to the caller (mount inside a
 * `relative` composer container).
 *
 * Extra user candidates (e.g. current room participants or DM partner)
 * can be supplied via `extraUsers` — they appear first in the People
 * section without a second network round-trip.
 */
export type MentionPopoverSection = MentionKind;

export function MentionPopover({
  open,
  query,
  sections,
  extraUsers = [],
  onPick,
  onClose,
  className,
  tone = "light",
}: {
  open: boolean;
  query: string;
  sections: MentionPopoverSection[];
  extraUsers?: MentionSuggestion[];
  onPick: (s: MentionSuggestion) => void;
  onClose: () => void;
  className?: string;
  tone?: "light" | "dark";
}) {
  const { user } = useAuth();
  const uid = user?.id;
  const includeUsers = sections.includes("user");
  const includeCollabs = sections.includes("collab");
  const includeGroups = sections.includes("group");
  const includeEvents = sections.includes("event");

  const users = useUserSuggestions(query, open && includeUsers);
  const collabs = useMyCollabSuggestions(uid, query, open && includeCollabs);
  const groups = useGroupSuggestions(uid, query, open && includeGroups);
  const events = useEventSuggestions(uid, query, open && includeEvents);

  const q = query.trim().toLowerCase();

  // Filter the caller-provided extras by the current query.
  const filteredExtras: MentionSuggestion[] = useMemo(() => {
    if (!includeUsers) return [];
    const seen = new Set<string>();
    const out: MentionSuggestion[] = [];
    for (const c of extraUsers) {
      const label = c.label.toLowerCase();
      const sub = (c.sublabel ?? "").toLowerCase();
      if (q && !label.includes(q) && !sub.includes(q)) continue;
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
    return out.slice(0, 6);
  }, [extraUsers, q, includeUsers]);

  const flat: MentionSuggestion[] = useMemo(() => {
    const seen = new Set<string>();
    const list: MentionSuggestion[] = [];
    const push = (arr: MentionSuggestion[] | undefined) => {
      for (const s of arr ?? []) {
        const key = `${s.kind}:${s.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push(s);
      }
    };
    if (includeUsers) {
      push(filteredExtras);
      push(users.data);
    }
    if (includeCollabs) push(collabs.data);
    if (includeGroups) push(groups.data);
    if (includeEvents) push(events.data);
    return list;
  }, [
    filteredExtras,
    users.data,
    collabs.data,
    groups.data,
    events.data,
    includeUsers,
    includeCollabs,
    includeGroups,
    includeEvents,
  ]);

  const [active, setActive] = useState(0);
  useEffect(() => {
    setActive(0);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (flat.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % flat.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + flat.length) % flat.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const pick = flat[active];
        if (pick) onPick(pick);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, flat, active, onPick, onClose]);

  if (!open || flat.length === 0) return null;

  // Section boundaries for visual dividers.
  const firstIndexByKind: Partial<Record<MentionKind, number>> = {};
  flat.forEach((s, i) => {
    if (firstIndexByKind[s.kind] === undefined) firstIndexByKind[s.kind] = i;
  });

  const KIND_LABEL: Record<MentionKind, string> = {
    user: "People",
    collab: "Your collabs",
    group: "Groups",
    event: "Upcoming events",
  };

  return (
    <div
      className={cn(
        "absolute bottom-full left-0 z-40 mb-2 w-80 max-w-[calc(100%-4rem)] overflow-hidden rounded-xl border shadow-lg",
        tone === "dark"
          ? "border-background/15 bg-background/95 backdrop-blur text-ink"
          : "border-border bg-popover text-ink",
        className,
      )}
      role="listbox"
    >
      <ul className="max-h-72 overflow-y-auto py-1 text-sm">
        {flat.map((s, i) => {
          const isSectionStart =
            i > 0 && firstIndexByKind[s.kind] === i && s.kind !== flat[i - 1].kind;
          const isFirst = i === 0 && s.kind !== "user";
          const activeItem = i === active;
          return (
            <li key={`${s.kind}-${s.id}`}>
              {(isSectionStart || isFirst) && (
                <div className="mt-1 border-t border-border px-3 pt-2 text-[10px] font-medium uppercase tracking-wide text-ink-muted first:border-t-0 first:mt-0 first:pt-1">
                  {KIND_LABEL[s.kind]}
                </div>
              )}
              <button
                type="button"
                role="option"
                aria-selected={activeItem}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left",
                  activeItem ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <SuggestionIcon suggestion={s} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink">{s.label}</span>
                  {s.sublabel && (
                    <span className="block truncate text-[11px] text-ink-muted">{s.sublabel}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SuggestionIcon({ suggestion: s }: { suggestion: MentionSuggestion }) {
  if (s.kind === "user") {
    return s.avatar ? (
      <img src={s.avatar} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
    ) : (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-ink-muted">
        {(s.label[0] || "?").toUpperCase()}
      </div>
    );
  }
  if (s.kind === "collab") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Megaphone className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (s.kind === "group") {
    return s.avatar ? (
      <img src={s.avatar} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
    ) : (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet/15 text-violet">
        <Users className="h-3.5 w-3.5" />
      </span>
    );
  }
  return s.avatar ? (
    <img src={s.avatar} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
  ) : (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-coral/15 text-coral">
      <Calendar className="h-3.5 w-3.5" />
    </span>
  );
}
