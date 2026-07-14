import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, X, MapPin, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export type PickerGroup = {
  id: string;
  slug: string;
  name: string;
  kind: "city" | "genre" | "micro" | "scene";
  member_count: number;
};

export function GroupPicker({
  value,
  onChange,
  max = 3,
  label = "Groups",
  hint = "Tag this post into up to 3 Groups. Joined Groups appear first.",
}: {
  value: PickerGroup[];
  onChange: (next: PickerGroup[]) => void;
  max?: number;
  label?: string;
  hint?: string;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  // All public groups (lightweight — 200 cap matches /groups index)
  const { data: all = [] } = useQuery({
    queryKey: ["group-picker", "all"],
    queryFn: async (): Promise<PickerGroup[]> => {
      const { data } = await supabase
        .from("groups")
        .select("id,slug,name,kind,member_count")
        .is("deleted_at", null)
        .eq("visibility", "public")
        .order("member_count", { ascending: false })
        .limit(200);
      return (data ?? []) as PickerGroup[];
    },
    staleTime: 60_000,
  });

  // User's joined groups for sort priority
  const { data: myIds = [] } = useQuery({
    queryKey: ["my-group-ids", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id);
      return (data ?? []).map((r) => r.group_id as string);
    },
    staleTime: 30_000,
  });

  const myIdSet = useMemo(() => new Set(myIds), [myIds]);
  const selectedIds = useMemo(() => new Set(value.map((v) => v.id)), [value]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = all.filter(
      (g) => !selectedIds.has(g.id) && (q === "" || g.name.toLowerCase().includes(q)),
    );
    // Joined first, then by member_count (already pre-sorted)
    return filtered
      .sort((a, b) => Number(myIdSet.has(b.id)) - Number(myIdSet.has(a.id)))
      .slice(0, 8);
  }, [all, query, selectedIds, myIdSet]);

  const atMax = value.length >= max;

  function add(g: PickerGroup) {
    if (atMax) return;
    if (selectedIds.has(g.id)) return;
    onChange([...value, g]);
    setQuery("");
    setOpen(false);
  }

  function remove(id: string) {
    onChange(value.filter((g) => g.id !== id));
  }

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-ink-muted">
          {value.length}/{max}
        </span>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((g) => {
            const Icon = g.kind === "city" ? MapPin : Sparkles;
            return (
              <span
                key={g.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink"
              >
                <Icon className="h-3 w-3 text-ink-muted" />
                {g.name}
                <button
                  type="button"
                  onClick={() => remove(g.id)}
                  className="text-ink-muted hover:text-ink"
                  aria-label={`Remove ${g.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {!atMax && (
        <div className="relative">
          <div className="flex h-10 items-center gap-2 rounded-full border border-input bg-background px-3">
            <Search className="h-3.5 w-3.5 text-ink-muted" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder={value.length === 0 ? "Search Groups (City, Genre, Scene…)" : "Add another"}
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none"
            />
          </div>

          {open && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-72 overflow-auto rounded-2xl border border-border bg-surface p-1 shadow-lift">
              {suggestions.map((g) => {
                const Icon = g.kind === "city" ? MapPin : Sparkles;
                const joined = myIdSet.has(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(g)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 text-ink-muted" />
                    <span className="flex-1 truncate text-ink">{g.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-ink-muted">
                      {g.kind}
                    </span>
                    {joined && (
                      <span className="rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] text-ink-soft">
                        Joined
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-ink-muted">{hint}</p>
    </section>
  );
}

/**
 * Hook: hydrate a starting GroupPicker value from a preselect slug
 * (used by /works/new?group=slug, /collab/new?group=slug, etc.)
 * Returns null until ready; component should default to [] when null.
 */
export function usePreselectGroup(slug: string | undefined) {
  return useQuery({
    queryKey: ["group-picker", "preselect", slug ?? ""],
    enabled: !!slug,
    queryFn: async (): Promise<PickerGroup[]> => {
      const { data } = await supabase
        .from("groups")
        .select("id,slug,name,kind,member_count")
        .eq("slug", slug!)
        .is("deleted_at", null)
        .maybeSingle();
      return data ? [data as PickerGroup] : [];
    },
    staleTime: 60_000,
  });
}
