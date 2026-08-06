import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Users, MapPin, Calendar, User, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { BlogEntityKind, BlogEntityTag } from "@/lib/blog-entity-tags";
import { kindLabel, tagKey } from "@/lib/blog-entity-tags";
import {
  searchWorks,
  searchCollabs,
  searchGroups,
  searchEvents,
  searchProfiles,
  type EntitySearchHit,
} from "@/lib/entities/search";

const KIND_ICONS: Record<BlogEntityKind, typeof Briefcase> = {
  work: Briefcase,
  collab: Users,
  group: MapPin,
  event: Calendar,
  profile: User,
};

/**
 * Shared search hit -> the Blog's own tag shape. Blog tags carry an extra
 * `work` summary so the "About this post" panel can render mediums live from
 * the Work's subtype before the post is saved.
 */
function hitToBlogTag(hit: EntitySearchHit): BlogEntityTag {
  const common = {
    id: hit.id,
    label: hit.label,
    sublabel: hit.sublabel ?? null,
    image: hit.image ?? null,
  };
  switch (hit.kind) {
    case "work":
      return {
        kind: "work",
        slug: hit.slug,
        ...common,
        work: {
          excerpt: null,
          categories: hit.category ? [hit.category] : [],
          subtype: hit.subtype ?? null,
          cover_url: hit.image ?? null,
          cover_aspect: null,
          cover_focal_x: null,
          cover_focal_y: null,
          credits: [],
        },
      };
    case "collab":
      return { kind: "collab", slug: hit.slug, ...common };
    case "group":
      return { kind: "group", slug: hit.slug, ...common };
    case "event":
      return { kind: "event", slug: hit.slug, groupSlug: hit.groupSlug, ...common };
    case "profile":
      return { kind: "profile", username: hit.username, ...common };
    case "post":
      // The Blog picker never searches posts; keep the switch exhaustive.
      throw new Error("Blog posts are not taggable as post-context");
  }
}


type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (tag: BlogEntityTag) => void;
  disabledKeys?: string[];
  title?: string;
  description?: string;
  /** Tab the picker opens on. Defaults to every kind. */
  initialKind?: BlogEntityKind | "all";
  /** Renders "Can't find it? Create a Work" in the Works group. */
  onRequestCreateWork?: () => void;
};

const KIND_TABS: Array<{ value: BlogEntityKind | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "work", label: "Works" },
  { value: "collab", label: "Collabs" },
  { value: "group", label: "Groups" },
  { value: "event", label: "Events" },
  { value: "profile", label: "People" },
];

export function BlogEntityTagPicker({
  open,
  onOpenChange,
  onPick,
  disabledKeys,
  title,
  description,
  initialKind = "all",
  onRequestCreateWork,
}: Props) {
  const [tab, setTab] = useState<BlogEntityKind | "all">(initialKind);
  const [q, setQ] = useState("");
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialKind);
    } else {
      setQ("");
      setTab(initialKind);
    }
  }, [open, initialKind]);

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, [open]);

  const disabled = useMemo(() => new Set(disabledKeys ?? []), [disabledKeys]);

  const query = q.trim().toLowerCase();
  const enabled = open;

  // Every group below runs the one shared Workshop entity search, in the
  // `editorial` context: the complete public record (finished collabs, past
  // events) rather than the "what's happening now" bias the `@` popover uses.
  const useKind = (
    kind: BlogEntityKind,
    fn: (opts: { query: string; viewerId?: string | null; context: "editorial" }) => Promise<EntitySearchHit[]>,
    extraEnabled = true,
  ) =>
    useQuery({
      queryKey: ["blog-tag-picker", kind, query, uid],
      enabled: enabled && (tab === "all" || tab === kind) && extraEnabled,
      staleTime: 30_000,
      queryFn: async (): Promise<BlogEntityTag[]> =>
        (await fn({ query, viewerId: uid, context: "editorial" })).map(hitToBlogTag),
    });

  const worksQ = useKind("work", searchWorks);
  const collabsQ = useKind("collab", searchCollabs);
  const groupsQ = useKind("group", searchGroups);
  const eventsQ = useKind("event", searchEvents);
  const profilesQ = useKind("profile", searchProfiles, query.length >= 1);

  const groups: Array<{
    kind: BlogEntityKind;
    label: string;
    results: BlogEntityTag[];
    loading: boolean;
  }> = [
    { kind: "work", label: "Works", results: worksQ.data ?? [], loading: worksQ.isLoading },
    { kind: "collab", label: "Collabs", results: collabsQ.data ?? [], loading: collabsQ.isLoading },
    { kind: "group", label: "Groups", results: groupsQ.data ?? [], loading: groupsQ.isLoading },
    { kind: "event", label: "Events", results: eventsQ.data ?? [], loading: eventsQ.isLoading },
    {
      kind: "profile",
      label: "People",
      results: profilesQ.data ?? [],
      loading: profilesQ.isLoading,
    },
  ];
  const visible =
    tab === "all"
      ? groups.filter((g) => g.results.length > 0 || g.loading)
      : groups.filter((g) => g.kind === tab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title ?? "Add a connection"}</DialogTitle>
          <DialogDescription>
            {description ??
              "Connect this post to the Work, Collab, Group, Event, or person it is substantially about."}
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="h-11 w-full rounded-full border border-border bg-background px-9 text-[16px] text-ink focus:border-primary focus:outline-none"
          />
        </div>
        <div className="-mx-1 mt-1 flex items-center gap-1 overflow-x-auto px-1">
          {KIND_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs",
                tab === t.value
                  ? "border-ink bg-ink text-background"
                  : "border-border bg-surface text-ink-soft hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="max-h-[50vh] overflow-y-auto pr-1">
          {visible.length === 0 && (
            <div className="py-8 text-center text-sm text-ink-muted">
              Nothing to show. Try a different search.
            </div>
          )}
          {onRequestCreateWork && (tab === "all" || tab === "work") && (
            <button
              type="button"
              onClick={onRequestCreateWork}
              className="mt-3 w-full rounded-xl border border-dashed border-border px-3 py-2 text-left text-xs text-primary hover:bg-muted"
            >
              Can't find it? Create a Work →
            </button>
          )}
          {visible.map((g) => (
            <div key={g.kind} className="mt-3">
              <div className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                {g.label}
              </div>

              {g.loading && g.results.length === 0 && (
                <div className="px-2 py-2 text-xs text-ink-muted">Loading…</div>
              )}
              {g.results.map((r) => {
                const key = tagKey(r);
                const isDisabled = disabled.has(key);
                const Icon = KIND_ICONS[r.kind];
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      onPick(r);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition",
                      isDisabled ? "opacity-40" : "hover:border-border hover:bg-muted",
                    )}
                  >
                    <Avatar className="h-9 w-9">
                      {r.image ? <AvatarImage src={r.image} alt="" /> : null}
                      <AvatarFallback className="text-[11px]">
                        <Icon className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-ink">{r.label}</div>
                      {r.sublabel && (
                        <div className="truncate text-xs text-ink-muted">{r.sublabel}</div>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-ink-muted">
                      {kindLabel(r.kind)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
