import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Users, MapPin, Calendar, User, Search, BookOpen } from "lucide-react";
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
import {
  searchWorks,
  searchCollabs,
  searchGroups,
  searchEvents,
  searchProfiles,
  searchBlogPosts,
  type EntitySearchHit,
  type EntitySearchContext,
} from "@/lib/entities/search";
import type { WorkshopEntityKind, WorkshopEntityRef } from "@/lib/entities/kinds";

const KIND_ICONS: Record<WorkshopEntityKind, typeof Briefcase> = {
  profile: User,
  work: Briefcase,
  collab: Users,
  group: MapPin,
  event: Calendar,
  post: BookOpen,
};

const KIND_LABELS: Record<WorkshopEntityKind, string> = {
  profile: "People",
  work: "Works",
  collab: "Collabs",
  group: "Groups",
  event: "Events",
  post: "Posts",
};

/** Default kinds when a caller doesn't narrow. Posts are opt-in (Blog only). */
const ALL_PICKABLE_KINDS: readonly WorkshopEntityKind[] = [
  "profile",
  "work",
  "collab",
  "group",
  "event",
];

/** Display order for whatever subset a caller asks for. */
const KIND_ORDER: readonly WorkshopEntityKind[] = [...ALL_PICKABLE_KINDS, "post"];

export type EntityConnectionPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (hit: EntitySearchHit) => void;
  disabledKeys?: string[];
  /** Results to hide entirely (e.g. the post currently being edited). */
  excludeKeys?: string[];
  title?: string;
  description?: string;
  initialKind?: WorkshopEntityKind | "all";
  /** Restrict the picker to a subset of Workshop primitives. Defaults to all. */
  kinds?: readonly WorkshopEntityKind[];
  /** Search context passed to every search function. */
  context?: EntitySearchContext;
  /** Profile search requires query length >= this to avoid expensive full scans. */
  profileSearchMinLength?: number;
  /** Extra footer action rendered when the work tab is visible. */
  onRequestCreateWork?: () => void;
};

/**
 * The generic Workshop entity picker.
 *
 * Callers pass the kinds they want, the search context, and a transform for
 * the result. Blog tags, Collab context, Group cross-links, and Event showcases
 * all share this shell while keeping their own persisted shapes.
 */
export function EntityConnectionPicker({
  open,
  onOpenChange,
  onPick,
  disabledKeys,
  excludeKeys,
  title,
  description,
  initialKind = "all",
  kinds = ALL_PICKABLE_KINDS,
  context = "editorial",
  profileSearchMinLength = 1,
  onRequestCreateWork,
}: EntityConnectionPickerProps) {
  const availableKinds = useMemo(() => {
    const set = new Set(kinds);
    return KIND_ORDER.filter((k) => set.has(k));
  }, [kinds]);

  const defaultTab = useMemo(() => {
    if (initialKind === "all") return "all";
    return availableKinds.includes(initialKind) ? initialKind : availableKinds[0] ?? "all";
  }, [initialKind, availableKinds]);

  const [tab, setTab] = useState<WorkshopEntityKind | "all">(defaultTab);
  const [q, setQ] = useState("");
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab(defaultTab);
    } else {
      setQ("");
      setTab(defaultTab);
    }
  }, [open, defaultTab]);

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, [open]);

  const disabled = useMemo(() => new Set(disabledKeys ?? []), [disabledKeys]);
  const excluded = useMemo(() => new Set(excludeKeys ?? []), [excludeKeys]);

  const query = q.trim().toLowerCase();
  const enabled = open;

  const useKind = (
    kind: WorkshopEntityKind,
    fn: (opts: { query: string; viewerId?: string | null; context: EntitySearchContext }) => Promise<EntitySearchHit[]>,
    extraEnabled = true,
  ) =>
    useQuery({
      queryKey: ["entity-connection-picker", kind, query, uid, context],
      enabled: enabled && (tab === "all" || tab === kind) && extraEnabled,
      staleTime: 30_000,
      queryFn: () => fn({ query, viewerId: uid, context }),
    });

  const workQ = useKind("work", searchWorks);
  const collabQ = useKind("collab", searchCollabs);
  const groupQ = useKind("group", searchGroups);
  const eventQ = useKind("event", searchEvents);
  const profileQ = useKind("profile", searchProfiles, query.length >= profileSearchMinLength);
  const postQ = useKind("post", searchBlogPosts);

  const groups: Array<{
    kind: WorkshopEntityKind;
    label: string;
    results: EntitySearchHit[];
    loading: boolean;
  }> = useMemo(
    () =>
      availableKinds.map((kind) => {
        switch (kind) {
          case "work":
            return { kind, label: KIND_LABELS.work, results: workQ.data ?? [], loading: workQ.isLoading };
          case "collab":
            return { kind, label: KIND_LABELS.collab, results: collabQ.data ?? [], loading: collabQ.isLoading };
          case "group":
            return { kind, label: KIND_LABELS.group, results: groupQ.data ?? [], loading: groupQ.isLoading };
          case "event":
            return { kind, label: KIND_LABELS.event, results: eventQ.data ?? [], loading: eventQ.isLoading };
          case "profile":
            return { kind, label: KIND_LABELS.profile, results: profileQ.data ?? [], loading: profileQ.isLoading };
          case "post":
            return { kind, label: KIND_LABELS.post, results: postQ.data ?? [], loading: postQ.isLoading };
          default:
            return { kind, label: KIND_LABELS[kind], results: [], loading: false };
        }
      }).map((g) => ({
        ...g,
        results: g.results.filter((r) => !excluded.has(`${r.kind}:${r.id}`)),
      })),
    [availableKinds, workQ, collabQ, groupQ, eventQ, profileQ, postQ, excluded],
  );


  const visible =
    tab === "all"
      ? groups.filter((g) => g.results.length > 0 || g.loading)
      : groups.filter((g) => g.kind === tab);

  const tabs = useMemo(
    () => [
      { value: "all" as const, label: "All" },
      ...availableKinds.map((k) => ({ value: k, label: KIND_LABELS[k] })),
    ],
    [availableKinds],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title ?? "Add a connection"}</DialogTitle>
          <DialogDescription>
            {description ??
              "Connect this to the Work, Collab, Group, Event, or person it is substantially about."}
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
          {tabs.map((t) => (
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
              Can&apos;t find it? Create a Work →
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
                const key = `${r.kind}:${r.id}`;
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
                      <div className="truncate text-sm font-medium text-ink">{r.label}</div>
                      {r.sublabel && (
                        <div className="truncate text-xs text-ink-muted">{r.sublabel}</div>
                      )}
                    </div>
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

/** Convenience transform for callers that only need a canonical ref. */
export function hitToRef(hit: EntitySearchHit): WorkshopEntityRef {
  switch (hit.kind) {
    case "work":
      return hit;
    case "collab":
      return hit;
    case "group":
      return hit;
    case "event":
      return hit;
    case "profile":
      return hit;
    case "post":
      return hit;
  }
}

