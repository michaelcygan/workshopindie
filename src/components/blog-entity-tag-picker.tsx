import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Users, MapPin, Calendar, User, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { BlogEntityKind, BlogEntityTag } from "@/lib/blog-entity-tags";
import { kindLabel, tagKey } from "@/lib/blog-entity-tags";

const KIND_ICONS: Record<BlogEntityKind, typeof Briefcase> = {
  work: Briefcase,
  collab: Users,
  group: MapPin,
  event: Calendar,
  profile: User,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (tag: BlogEntityTag) => void;
  disabledKeys?: string[];
  title?: string;
};

const KIND_TABS: Array<{ value: BlogEntityKind | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "work", label: "Works" },
  { value: "collab", label: "Collabs" },
  { value: "group", label: "Groups" },
  { value: "event", label: "Events" },
  { value: "profile", label: "People" },
];

export function BlogEntityTagPicker({ open, onOpenChange, onPick, disabledKeys, title }: Props) {
  const [tab, setTab] = useState<BlogEntityKind | "all">("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) {
      setQ("");
      setTab("all");
    }
  }, [open]);

  const disabled = useMemo(() => new Set(disabledKeys ?? []), [disabledKeys]);

  const query = q.trim().toLowerCase();
  const enabled = open;

  const worksQ = useQuery({
    queryKey: ["blog-tag-picker-works", query],
    enabled: enabled && (tab === "all" || tab === "work"),
    staleTime: 30_000,
    queryFn: async (): Promise<BlogEntityTag[]> => {
      let req = supabase
        .from("works")
        .select("id,slug,title,category,cover_url")
        .eq("status", "published")
        .in("visibility", ["public", "unlisted"])
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(8);
      if (query) req = req.ilike("title", `%${query}%`);
      const { data } = await req;
      return (data ?? []).map((r) => ({
        kind: "work" as const,
        id: r.id,
        slug: r.slug,
        label: r.title,
        sublabel: r.category ? r.category.charAt(0).toUpperCase() + r.category.slice(1) : null,
        image: r.cover_url,
      }));
    },
  });

  const collabsQ = useQuery({
    queryKey: ["blog-tag-picker-collabs", query],
    enabled: enabled && (tab === "all" || tab === "collab"),
    staleTime: 30_000,
    queryFn: async (): Promise<BlogEntityTag[]> => {
      let req = supabase
        .from("collab_posts")
        .select("id,slug,title,description,cover_url")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(8);
      if (query) req = req.ilike("title", `%${query}%`);
      const { data } = await req;
      return (data ?? []).map((r) => ({
        kind: "collab" as const,
        id: r.id,
        slug: r.slug,
        label: r.title,
        sublabel: r.description ?? null,
        image: r.cover_url,
      }));
    },
  });

  const groupsQ = useQuery({
    queryKey: ["blog-tag-picker-groups", query],
    enabled: enabled && (tab === "all" || tab === "group"),
    staleTime: 30_000,
    queryFn: async (): Promise<BlogEntityTag[]> => {
      let req = supabase
        .from("groups")
        .select("id,slug,name,tagline,avatar_url")
        .eq("visibility", "public")
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .limit(8);
      if (query) req = req.ilike("name", `%${query}%`);
      const { data } = await req;
      return (data ?? []).map((r) => ({
        kind: "group" as const,
        id: r.id,
        slug: r.slug,
        label: r.name,
        sublabel: r.tagline ?? null,
        image: r.avatar_url,
      }));
    },
  });

  const eventsQ = useQuery({
    queryKey: ["blog-tag-picker-events", query],
    enabled: enabled && (tab === "all" || tab === "event"),
    staleTime: 30_000,
    queryFn: async (): Promise<BlogEntityTag[]> => {
      let req = supabase
        .from("group_events")
        .select("id,slug,title,tagline,cover_url,starts_at,group:groups!group_events_group_id_fkey(slug,name)")
        .is("deleted_at", null)
        .in("visibility", ["public", "unlisted"])
        .order("starts_at", { ascending: false })
        .limit(12);
      if (query) req = req.ilike("title", `%${query}%`);
      const { data } = await req;
      const rows = (data ?? []) as unknown as Array<{
        id: string; slug: string; title: string; tagline: string | null; cover_url: string | null;
        starts_at: string; group: { slug: string; name: string } | null;
      }>;
      return rows
        .filter((r) => r.group?.slug)
        .slice(0, 8)
        .map((r) => ({
          kind: "event" as const,
          id: r.id,
          slug: r.slug,
          groupSlug: r.group!.slug,
          label: r.title,
          sublabel: r.group!.name,
          image: r.cover_url,
        }));
    },
  });

  const profilesQ = useQuery({
    queryKey: ["blog-tag-picker-profiles", query],
    enabled: enabled && (tab === "all" || tab === "profile") && query.length >= 1,
    staleTime: 30_000,
    queryFn: async (): Promise<BlogEntityTag[]> => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,headline")
        .or(`username.ilike.${query}%,display_name.ilike.%${query}%`)
        .not("username", "is", null)
        .limit(8);
      return (data ?? [])
        .filter((r) => r.username)
        .map((r) => ({
          kind: "profile" as const,
          id: r.id,
          username: r.username as string,
          label: r.display_name || (r.username as string),
          sublabel: r.headline ?? `@${r.username}`,
          image: r.avatar_url,
        }));
    },
  });

  const groups: Array<{ kind: BlogEntityKind; label: string; results: BlogEntityTag[]; loading: boolean }> = [
    { kind: "work", label: "Works", results: worksQ.data ?? [], loading: worksQ.isLoading },
    { kind: "collab", label: "Collabs", results: collabsQ.data ?? [], loading: collabsQ.isLoading },
    { kind: "group", label: "Groups", results: groupsQ.data ?? [], loading: groupsQ.isLoading },
    { kind: "event", label: "Events", results: eventsQ.data ?? [], loading: eventsQ.isLoading },
    { kind: "profile", label: "People", results: profilesQ.data ?? [], loading: profilesQ.isLoading },
  ];
  const visible = tab === "all" ? groups.filter((g) => g.results.length > 0 || g.loading) : groups.filter((g) => g.kind === tab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title ?? "Tag a Workshop item"}</DialogTitle>
          <DialogDescription>Connect this post to a Work, Collab, Group, Event, or Person.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-full border border-border bg-background px-9 py-2 text-sm text-ink focus:border-primary focus:outline-none"
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
            <div className="py-8 text-center text-sm text-ink-muted">Nothing to show. Try a different search.</div>
          )}
          {visible.map((g) => (
            <div key={g.kind} className="mt-3">
              <div className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wider text-ink-muted">{g.label}</div>
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
                      {r.sublabel && <div className="truncate text-xs text-ink-muted">{r.sublabel}</div>}
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
