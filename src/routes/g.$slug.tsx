import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Sparkles, Users, Star, LayoutGrid, Megaphone, Radio, Info, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { JoinGroupButton } from "@/components/join-group-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageButton } from "@/components/message-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  tagWorkInGroup,
  untagWorkInGroup,
  tagCollabInGroup,
  untagCollabInGroup,
  tagWorkshopInGroup,
  untagWorkshopInGroup,
} from "@/lib/groups.functions";
import { toast } from "sonner";

type GroupRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  kind: "city" | "genre" | "micro" | "scene";
  cover_url: string | null;
  avatar_url: string | null;
  accent_color: string | null;
  member_count: number;
  workshop_count: number;
  collab_count: number;
  work_count: number;
  is_official: boolean;
  featured_at: string | null;
};

async function fetchGroup(slug: string): Promise<GroupRow> {
  const { data, error } = await supabase
    .from("groups")
    .select(
      "id,slug,name,tagline,description,kind,cover_url,avatar_url,accent_color,member_count,workshop_count,collab_count,work_count,is_official,featured_at",
    )
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return data as unknown as GroupRow;
}

export const Route = createFileRoute("/g/$slug")({
  loader: async ({ params }) => fetchGroup(params.slug),
  component: GroupPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-ink">Couldn't load this Group.</h1>
        <p className="mt-2 text-sm text-ink-muted">{error.message}</p>
        <Button
          className="mt-6 rounded-full"
          onClick={() => {
            reset();
            router.invalidate();
          }}
        >
          Try again
        </Button>
      </main>
    );
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">Group not found.</h1>
      <Link to="/groups" className="mt-4 inline-block text-sm text-primary underline">
        Browse all Groups
      </Link>
    </main>
  ),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} — Group on Workshop` },
          { name: "description", content: loaderData.tagline ?? loaderData.description ?? "Join this Group on Workshop." },
          { property: "og:title", content: `${loaderData.name} — Group on Workshop` },
          { property: "og:description", content: loaderData.tagline ?? loaderData.description ?? "Join this Group on Workshop." },
          ...(loaderData.cover_url ? [{ property: "og:image", content: loaderData.cover_url }] : []),
        ]
      : [],
  }),
});

type Tab = "workshops" | "collab" | "work" | "members" | "about";

function GroupPage() {
  const group = Route.useLoaderData();
  const [tab, setTab] = useState<Tab>("work");
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`group-${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${group.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["group", group.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_works", filter: `group_id=eq.${group.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["group", group.id, "works"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_collabs", filter: `group_id=eq.${group.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["group", group.id, "collabs"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_workshops", filter: `group_id=eq.${group.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["group", group.id, "workshops"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [group.id, qc]);

  const Icon = group.kind === "city" ? MapPin : Sparkles;

  return (
    <main className="mx-auto max-w-7xl pb-20">
      {/* Hero */}
      <div
        className={cn(
          "relative h-48 w-full md:h-64",
          group.cover_url ? "bg-cover bg-center" : "gradient-motion",
        )}
        style={group.cover_url ? { backgroundImage: `url(${group.cover_url})` } : undefined}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/90" />
      </div>

      <div className="-mt-12 px-4 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border-4 border-background bg-surface shadow-lift">
              {group.avatar_url ? (
                <img src={group.avatar_url} alt={group.name} className="h-full w-full rounded-2xl object-cover" />
              ) : (
                <Icon className="h-10 w-10 text-ink-muted" />
              )}
            </div>
            <div className="pt-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-soft">
                  {group.kind}
                </span>
                {group.featured_at && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    <Star className="h-3 w-3" /> Featured
                  </span>
                )}
                {group.is_official && (
                  <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-medium text-ink-soft">Official</span>
                )}
              </div>
              <h1 className="mt-1 font-display text-3xl text-ink md:text-4xl">{group.name}</h1>
              {group.tagline && <p className="mt-1 text-sm text-ink-muted md:text-base">{group.tagline}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {group.member_count} members</span>
                <span>· {group.workshop_count} Workshops</span>
                <span>· {group.collab_count} Collabs</span>
                <span>· {group.work_count} Work</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:pb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full gap-1.5">
                  <Plus className="h-4 w-4" /> Post here
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                  <Link to="/works/new" search={{ group: group.slug }}>New Work</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/collab/new" search={{ group: group.slug }}>New Collab</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/workshops/new" search={{ group: group.slug }}>New Workshop</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <JoinGroupButton groupId={group.id} />
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex flex-wrap gap-1.5 border-b border-border">
          {[
            { id: "work" as const, label: "Work", icon: LayoutGrid, count: group.work_count },
            { id: "collab" as const, label: "Collabs", icon: Megaphone, count: group.collab_count },
            { id: "workshops" as const, label: "Workshops", icon: Radio, count: group.workshop_count },
            { id: "members" as const, label: "Members", icon: Users, count: group.member_count },
            { id: "about" as const, label: "About", icon: Info, count: null },
          ].map((t) => {
            const TIcon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition",
                  active
                    ? "border-ink text-ink"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                <TIcon className="h-4 w-4" />
                {t.label}
                {t.count !== null && (
                  <span className="text-[11px] text-ink-muted/80">{t.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="mt-8">
          {tab === "work" && <GroupWorkTab group={group} />}
          {tab === "collab" && <GroupCollabTab group={group} />}
          {tab === "workshops" && <GroupWorkshopTab group={group} />}
          {tab === "members" && <GroupMembersTab group={group} />}
          {tab === "about" && <GroupAboutTab group={group} />}
        </div>
      </div>
    </main>
  );
}

function GroupAboutTab({ group }: { group: GroupRow }) {
  return (
    <div className="prose prose-sm max-w-3xl text-ink">
      {group.description ? (
        <p className="whitespace-pre-wrap text-ink">{group.description}</p>
      ) : (
        <p className="text-ink-muted">No description yet.</p>
      )}
    </div>
  );
}

/* ---------- WORKS ---------- */
type WorkRow = {
  id: string; title: string; slug: string; cover_url: string | null;
};

function GroupWorkTab({ group }: { group: GroupRow }) {
  const { data: works = [], isLoading } = useQuery({
    queryKey: ["group", group.id, "works"],
    queryFn: async (): Promise<WorkRow[]> => {
      const { data } = await supabase
        .from("group_works")
        .select("work:works(id,title,slug,cover_url,published_at)")
        .eq("group_id", group.id)
        .limit(48);
      return (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.work)
        .filter((w: WorkRow | null) => !!w && (w as unknown as { published_at?: string | null }).published_at) as WorkRow[];
    },
  });

  return (
    <div>
      <AddMineToGroup group={group} entity="work" />
      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : works.length === 0 ? (
        <EmptyState label="No Work tagged to this Group yet." cta="Browse all Work" to="/gallery" />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {works.map((w) => (
            <Link
              key={w.id}
              to="/works/$slug"
              params={{ slug: w.slug }}
              className="overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div
                className={cn(
                  "h-32 w-full",
                  w.cover_url ? "bg-cover bg-center" : "bg-surface-2",
                )}
                style={w.cover_url ? { backgroundImage: `url(${w.cover_url})` } : undefined}
              />
              <div className="p-3">
                <div className="font-display text-base text-ink line-clamp-2">{w.title}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- COLLABS ---------- */
type CollabRow = {
  id: string; title: string; slug: string; description: string | null;
};

function GroupCollabTab({ group }: { group: GroupRow }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["group", group.id, "collabs"],
    queryFn: async (): Promise<CollabRow[]> => {
      const { data } = await supabase
        .from("group_collabs")
        .select("collab:collab_posts(id,title,slug,description,status)")
        .eq("group_id", group.id)
        .limit(48);
      return (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.collab)
        .filter((c: (CollabRow & { status?: string }) | null) => !!c && c.status === "open") as CollabRow[];
    },
  });

  return (
    <div>
      <AddMineToGroup group={group} entity="collab" />
      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState label="No Collabs in this Group yet." cta="Browse all Collabs" to="/collab" />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((c) => (
            <Link
              key={c.id}
              to="/collab/$slug"
              params={{ slug: c.slug }}
              className="rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <h3 className="font-display text-lg text-ink line-clamp-2">{c.title}</h3>
              {c.description && (
                <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{c.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- WORKSHOPS ---------- */
type WSRow = { id: string; title: string; slug: string; status: string };

function GroupWorkshopTab({ group }: { group: GroupRow }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["group", group.id, "workshops"],
    queryFn: async (): Promise<WSRow[]> => {
      const { data } = await supabase
        .from("group_workshops")
        .select("workshop:workshops(id,title,slug,status,archived_at)")
        .eq("group_id", group.id)
        .limit(48);
      return (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.workshop)
        .filter((w: (WSRow & { archived_at?: string | null }) | null) => !!w && !w.archived_at) as WSRow[];
    },
  });

  return (
    <div>
      <AddMineToGroup group={group} entity="workshop" />
      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState label="No Workshops tagged to this Group yet." cta="Browse all Workshops" to="/workshops" />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((w) => (
            <Link
              key={w.id}
              to="/workshops/$slug"
              params={{ slug: w.slug }}
              className="rounded-2xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <h3 className="font-display text-lg text-ink line-clamp-2">{w.title}</h3>
              <p className="mt-1 text-xs text-ink-muted">{w.status}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- MEMBERS ---------- */
function GroupMembersTab({ group }: { group: GroupRow }) {
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["group", group.id, "members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("user:profiles!group_members_user_id_fkey(id,username,display_name,avatar_url,hide_group_memberships)")
        .eq("group_id", group.id)
        .limit(200);
      return (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.user)
        .filter((u: { hide_group_memberships?: boolean } | null) => !!u && !u.hide_group_memberships) as {
          id: string; username: string | null; display_name: string | null; avatar_url: string | null;
        }[];
    },
  });

  if (isLoading) return <div className="h-32 animate-pulse rounded-2xl bg-surface-2" />;
  if (members.length === 0) {
    return <EmptyState label="No public members yet." cta="Be the first to join" to="/g/$slug" toParams={{ slug: group.slug }} />;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {members.map((m) => (
        <Link
          key={m.id}
          to="/u/$username"
          params={{ username: m.username ?? "" }}
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:bg-muted"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={m.avatar_url ?? undefined} />
            <AvatarFallback>{(m.display_name ?? m.username ?? "?")[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-ink">{m.display_name ?? m.username}</div>
            {m.username && <div className="truncate text-xs text-ink-muted">@{m.username}</div>}
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ---------- helpers ---------- */
function EmptyState({
  label,
  cta,
  to,
  toParams,
}: {
  label: string;
  cta: string;
  to: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toParams?: any;
}) {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
      <p className="text-sm text-ink-muted">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Link to={to as any} params={toParams} className="mt-3 inline-block text-sm text-primary underline">
        {cta}
      </Link>
    </div>
  );
}

function AddMineToGroup({
  group,
  entity,
}: {
  group: GroupRow;
  entity: "work" | "collab" | "workshop";
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const tagWorkFn = useServerFn(tagWorkInGroup);
  const untagWorkFn = useServerFn(untagWorkInGroup);
  const tagCollabFn = useServerFn(tagCollabInGroup);
  const untagCollabFn = useServerFn(untagCollabInGroup);
  const tagWorkshopFn = useServerFn(tagWorkshopInGroup);
  const untagWorkshopFn = useServerFn(untagWorkshopInGroup);

  const myPostsQuery = useQuery({
    enabled: !!user && open,
    queryKey: ["my-postable", entity, user?.id ?? "anon", group.id],
    queryFn: async () => {
      if (entity === "work") {
        const { data } = await supabase
          .from("works")
          .select("id,title,slug")
          .eq("created_by", user!.id)
          .not("published_at", "is", null)
          .order("published_at", { ascending: false })
          .limit(30);
        return (data ?? []) as { id: string; title: string; slug: string }[];
      }
      if (entity === "collab") {
        const { data } = await supabase
          .from("collab_posts")
          .select("id,title,slug")
          .eq("user_id", user!.id)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(30);
        return (data ?? []) as { id: string; title: string; slug: string }[];
      }
      const { data } = await supabase
        .from("workshops")
        .select("id,title,slug")
        .eq("host_user_id", user!.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []) as { id: string; title: string; slug: string }[];
    },
  });

  const taggedQuery = useQuery({
    enabled: !!user && open,
    queryKey: ["my-tagged-in-group", entity, group.id, user?.id ?? "anon"],
    queryFn: async (): Promise<Set<string>> => {
      if (!user) return new Set();
      if (entity === "work") {
        const { data } = await supabase
          .from("group_works")
          .select("work_id,works!inner(created_by)")
          .eq("group_id", group.id)
          .eq("works.created_by", user.id);
        return new Set((data ?? []).map((r) => r.work_id as string));
      }
      if (entity === "collab") {
        const { data } = await supabase
          .from("group_collabs")
          .select("collab_post_id,collab_posts!inner(user_id)")
          .eq("group_id", group.id)
          .eq("collab_posts.user_id", user.id);
        return new Set((data ?? []).map((r) => r.collab_post_id as string));
      }
      const { data } = await supabase
        .from("group_workshops")
        .select("workshop_id,workshops!inner(host_user_id)")
        .eq("group_id", group.id)
        .eq("workshops.host_user_id", user.id);
      return new Set((data ?? []).map((r) => r.workshop_id as string));
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, currentlyTagged }: { id: string; currentlyTagged: boolean }) => {
      if (entity === "work") {
        return currentlyTagged
          ? untagWorkFn({ data: { group_id: group.id, work_id: id } })
          : tagWorkFn({ data: { group_id: group.id, work_id: id } });
      }
      if (entity === "collab") {
        return currentlyTagged
          ? untagCollabFn({ data: { group_id: group.id, collab_post_id: id } })
          : tagCollabFn({ data: { group_id: group.id, collab_post_id: id } });
      }
      return currentlyTagged
        ? untagWorkshopFn({ data: { group_id: group.id, workshop_id: id } })
        : tagWorkshopFn({ data: { group_id: group.id, workshop_id: id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-tagged-in-group", entity, group.id] });
      qc.invalidateQueries({ queryKey: ["group", group.id] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;

  const labelMap = { work: "Work", collab: "Collab", workshop: "Workshop" };

  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink"
      >
        {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {open ? "Close" : `Add your ${labelMap[entity]} to ${group.name}`}
      </button>
      {open && (
        <div className="mt-3 space-y-1.5">
          {myPostsQuery.isLoading ? (
            <p className="text-xs text-ink-muted">Loading your {labelMap[entity]}…</p>
          ) : (myPostsQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-ink-muted">You don't have any {labelMap[entity]} to add yet.</p>
          ) : (
            (myPostsQuery.data ?? []).map((p) => {
              const tagged = taggedQuery.data?.has(p.id) ?? false;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: p.id, currentlyTagged: tagged })}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition",
                    tagged
                      ? "border-ink bg-ink/5 text-ink"
                      : "border-border bg-surface text-ink-soft hover:bg-muted hover:text-ink",
                  )}
                >
                  <span className="truncate">{p.title}</span>
                  <span className="ml-3 shrink-0 text-xs">
                    {tagged ? "Tagged" : "Add"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
