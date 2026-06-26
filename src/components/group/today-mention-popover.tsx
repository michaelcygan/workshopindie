import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type Suggestion =
  | {
      kind: "user";
      id: string;
      label: string;
      sublabel: string | null;
      avatar: string | null;
      insert: string;
    }
  | {
      kind: "collab";
      id: string;
      label: string;
      sublabel: string | null;
      insert: string;
    };

interface Props {
  open: boolean;
  query: string;
  groupId: string;
  onPick: (insert: string) => void;
  onClose: () => void;
  anchorClassName?: string;
}

export function TodayMentionPopover({
  open,
  query,
  groupId,
  onPick,
  onClose,
  anchorClassName,
}: Props) {
  const { user } = useAuth();
  const [activeIdx, setActiveIdx] = useState(0);
  const q = query.trim().toLowerCase();

  const { data: members = [] } = useQuery({
    queryKey: ["today-mention-members", groupId, q],
    enabled: open,
    queryFn: async () => {
      const { data: memberRows } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .limit(300);
      const ids = (memberRows ?? []).map((m) => m.user_id as string);
      if (ids.length === 0) return [] as Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null }>;
      let req = supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", ids)
        .not("username", "is", null)
        .limit(6);
      if (q) {
        req = req.or(`username.ilike.${q}%,display_name.ilike.%${q}%`);
      }
      const { data } = await req;
      return data ?? [];
    },
  });

  const { data: collabs = [] } = useQuery({
    queryKey: ["today-mention-collabs", user?.id, q],
    enabled: open && !!user,
    queryFn: async () => {
      let req = supabase
        .from("collab_posts")
        .select("id,title,slug,status")
        .eq("author_id", user!.id)
        .eq("status", "open")
        .limit(6);
      if (q) req = req.ilike("title", `%${q}%`);
      const { data } = await req;
      return data ?? [];
    },
  });

  const suggestions: Suggestion[] = useMemo(() => {
    const m: Suggestion[] = members
      .filter((p) => p.username)
      .map((p) => ({
        kind: "user" as const,
        id: p.id,
        label: p.display_name ?? p.username!,
        sublabel: `@${p.username}`,
        avatar: p.avatar_url,
        insert: `@${p.username}`,
      }));
    const c: Suggestion[] = collabs.map((row) => ({
      kind: "collab" as const,
      id: row.id,
      label: row.title,
      sublabel: "Your collab",
      insert: `[${row.title}](/collab/${row.slug})`,
    }));
    return [...m.slice(0, 6), ...c.slice(0, 6)];
  }, [members, collabs]);

  useEffect(() => {
    setActiveIdx(0);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (suggestions.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const pick = suggestions[activeIdx];
        if (pick) onPick(pick.insert);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, suggestions, activeIdx, onPick, onClose]);

  if (!open || suggestions.length === 0) return null;

  // Visual divider between users and collabs.
  const firstCollabIdx = suggestions.findIndex((s) => s.kind === "collab");

  return (
    <div
      className={cn(
        "absolute bottom-full left-3 z-40 mb-2 w-72 overflow-hidden rounded-xl border border-border bg-surface shadow-lg",
        anchorClassName,
      )}
      role="listbox"
    >
      <ul className="max-h-72 overflow-y-auto py-1 text-sm">
        {suggestions.map((s, i) => {
          const showDivider = i === firstCollabIdx && firstCollabIdx > 0;
          const active = i === activeIdx;
          return (
            <li key={`${s.kind}-${s.id}`}>
              {showDivider && (
                <div className="mt-1 border-t border-border px-3 pt-2 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                  Your collabs
                </div>
              )}
              <button
                type="button"
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(s.insert);
                }}
                onMouseEnter={() => setActiveIdx(i)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left",
                  active ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                {s.kind === "user" ? (
                  s.avatar ? (
                    <img
                      src={s.avatar}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-6 w-6 shrink-0 rounded-full bg-muted-foreground/20" />
                  )
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Megaphone className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink">{s.label}</span>
                  {s.sublabel && (
                    <span className="block truncate text-[11px] text-ink-muted">
                      {s.sublabel}
                    </span>
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
