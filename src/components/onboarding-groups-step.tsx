import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Check, MapPin, Sparkles, Star } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { joinGroup } from "@/lib/groups.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Group = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  kind: "city" | "genre" | "micro" | "scene";
  member_count: number;
  featured_at: string | null;
};

type Kind = "all" | "city" | "genre" | "micro" | "scene";

const TABS: { id: Kind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "genre", label: "Genres" },
  { id: "scene", label: "Scenes" },
  { id: "micro", label: "Micro" },
  { id: "city", label: "Cities" },
];

export function OnboardingGroupsStep({
  homeCityId,
  onDone,
  onSkip,
}: {
  homeCityId: string | null;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Kind>("all");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const join = useServerFn(joinGroup);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["onboarding-groups"],
    queryFn: async (): Promise<Group[]> => {
      const { data } = await supabase
        .from("groups")
        .select("id,slug,name,tagline,kind,member_count,featured_at,city_id")
        .is("deleted_at", null)
        .eq("visibility", "public")
        .order("featured_at", { ascending: false, nullsFirst: false })
        .order("member_count", { ascending: false })
        .limit(120);
      return (data ?? []) as Group[];
    },
  });

  // Pre-select the home-city mirror group, if present.
  useEffect(() => {
    if (!homeCityId || groups.length === 0) return;
    const mine = (groups as (Group & { city_id?: string | null })[]).find(
      (g) => g.kind === "city" && g.city_id === homeCityId,
    );
    if (mine) {
      setSelected((s) => {
        if (s.has(mine.id)) return s;
        const next = new Set(s);
        next.add(mine.id);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeCityId, groups.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = groups;
    if (tab !== "all") rows = rows.filter((g) => g.kind === tab);
    if (q) {
      rows = rows.filter(
        (g) => g.name.toLowerCase().includes(q) || (g.tagline ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [groups, tab, query]);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function commit() {
    if (selected.size === 0) {
      toast.error("Pick at least one Group, or skip for now.");
      return;
    }
    setSaving(true);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map((id) => join({ data: { group_id: id } })),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setSaving(false);
    if (failed > 0) {
      toast.error(`Joined ${ids.length - failed} of ${ids.length}. You can join the rest later.`);
    } else {
      toast.success(`Joined ${ids.length} Group${ids.length === 1 ? "" : "s"}`);
    }
    onDone();
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
        You're in
      </p>
      <h1 className="mt-1 font-display text-3xl text-ink">Pick a few Groups to fill your feed</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Groups are scenes, genres, and cities. Optional — you can join more anytime. Your home city is pre-selected.
      </p>

      <div className="mt-5 flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 shadow-soft">
        <Search className="h-4 w-4 text-ink-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Groups"
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              tab === t.id
                ? "bg-ink text-background"
                : "border border-border bg-surface text-ink-soft hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 max-h-[420px] overflow-y-auto rounded-2xl border border-border">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-2" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-muted">No matches. Try a different search.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2">
            {filtered.map((g) => {
              const on = selected.has(g.id);
              const Icon = g.kind === "city" ? MapPin : Sparkles;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggle(g.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 text-left transition",
                    on
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface hover:bg-muted",
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      on ? "bg-primary text-primary-foreground" : "bg-muted text-ink-muted",
                    )}
                  >
                    {on ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-ink">{g.name}</span>
                      {g.featured_at && <Star className="h-3 w-3 text-primary" />}
                    </div>
                    {g.tagline && (
                      <p className="line-clamp-1 text-xs text-ink-muted">{g.tagline}</p>
                    )}
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-muted">
                      <span>{g.kind}</span>
                      <span>·</span>
                      <span>{g.member_count} members</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Skip for now
        </button>
        <Button
          type="button"
          onClick={commit}
          disabled={saving || selected.size === 0}
          className="rounded-full"
        >
          {saving ? "Joining…" : `Continue${selected.size > 0 ? ` · ${selected.size}` : ""}`}
        </Button>
      </div>
    </div>
  );
}
