import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { JoinGroupButton } from "@/components/join-group-button";
import { GroupSeedJoinPrompt } from "@/components/group-seed-join-prompt";
import { GroupCard, type GroupCardData } from "@/components/group-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageButton } from "@/components/message-button";
import { cn } from "@/lib/utils";
import {
  tagWorkInGroup,
  untagWorkInGroup,
  tagCollabInGroup,
  untagCollabInGroup,
  tagWorkshopInGroup,
  untagWorkshopInGroup,
} from "@/lib/groups.functions";
import { resolveGroupSeedLink, redeemGroupSeedLink } from "@/lib/group-seed-links.functions";
import { toast } from "sonner";

import { AdjacentGroupsRail } from "@/components/adjacent-groups-rail";
import { GroupHero } from "@/components/group/group-hero";
import { GroupTabBar, type GroupTab } from "@/components/group/group-tab-bar";
import { GroupEmpty } from "@/components/group/group-empty";
import { GroupTodayTab } from "@/components/group/group-today-tab";
import { GroupNewsTicker } from "@/components/group/group-news-ticker";
import { setGroupNewsFeed } from "@/lib/group-admin.functions";



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
  parent_group_id: string | null;
  news_feed_url: string | null;
  parent: { id: string; slug: string; name: string } | null;
};


async function fetchGroup(slug: string): Promise<GroupRow> {
  const { data, error } = await supabase
    .from("groups")
    .select(
      "id,slug,name,tagline,description,kind,cover_url,avatar_url,accent_color,member_count,workshop_count,collab_count,work_count,is_official,featured_at,parent_group_id,news_feed_url",
    )
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  let parent: GroupRow["parent"] = null;
  if (data.parent_group_id) {
    const { data: p } = await supabase
      .from("groups")
      .select("id,slug,name")
      .eq("id", data.parent_group_id)
      .is("deleted_at", null)
      .maybeSingle();
    parent = p ?? null;
  }
  return { ...(data as Omit<GroupRow, "parent">), parent };
}


export const Route = createFileRoute("/g/$slug")({
  validateSearch: (s: Record<string, unknown>) => ({
    j: typeof s.j === "string" ? s.j : undefined,
  }),
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

type Tab = GroupTab;

function GroupPage() {
  const group = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Today is the default landing surface — ephemeral chat + fresh collabs.
  const [tab, setTab] = useState<Tab>("today");


  const qc = useQueryClient();

  // Admin seed-link flow (?j=<token>):
  //  • Always call resolve once (records click, surfaces banner copy).
  //  • Logged in → redeem immediately and strip ?j= from URL.
  //  • Logged out → render <GroupSeedJoinPrompt /> and stash token in
  //    sessionStorage so OAuth round-trips still complete the join.
  const seedToken = search.j;
  const resolveSeed = useServerFn(resolveGroupSeedLink);
  const redeemSeed = useServerFn(redeemGroupSeedLink);
  const [seedInfo, setSeedInfo] = useState<{ group_slug: string; group_name: string } | null>(null);
  const resolveOnce = useRef(false);
  const redeemOnce = useRef(false);

  useEffect(() => {
    if (!seedToken || resolveOnce.current) return;
    resolveOnce.current = true;
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(
          "ws.pendingGroupJoin",
          JSON.stringify({ token: seedToken, slug: group.slug }),
        );
      } catch { /* ignore */ }
    }
    resolveSeed({ data: { token: seedToken } })
      .then((info) => {
        if (!info) return;
        if (info.group_slug && info.group_slug !== group.slug) {
          navigate({ to: "/g/$slug", params: { slug: info.group_slug }, search: { j: seedToken } });
          return;
        }
        setSeedInfo({ group_slug: info.group_slug, group_name: info.group_name });
      })
      .catch(() => {});
  }, [seedToken, group.slug, navigate, resolveSeed]);

  useEffect(() => {
    if (!seedToken || !user || redeemOnce.current) return;
    redeemOnce.current = true;
    redeemSeed({ data: { token: seedToken } })
      .then((r) => {
        if (typeof window !== "undefined") sessionStorage.removeItem("ws.pendingGroupJoin");
        if (r.joined) toast.success(`Joined ${group.name}`);
        qc.invalidateQueries({ queryKey: ["group-membership", group.id] });
        qc.invalidateQueries({ queryKey: ["my-group-ids"] });
        qc.invalidateQueries({ queryKey: ["group", group.id] });
        navigate({ to: "/g/$slug", params: { slug: group.slug }, search: {}, replace: true });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedToken, user]);


  const { data: nextEvent } = useQuery({
    queryKey: ["group", group.id, "next-event"],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_events")
        .select("slug,title,starts_at")
        .eq("group_id", group.id)
        .is("deleted_at", null)
        .gt("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: childGroups = [] } = useQuery({
    queryKey: ["group", group.id, "children"],
    queryFn: async () => {
      const { data } = await supabase
        .from("groups")
        .select(
          "id,slug,name,tagline,kind,cover_url,avatar_url,accent_color,member_count,workshop_count,collab_count,work_count,is_official,featured_at",
        )
        .eq("parent_group_id", group.id)
        .is("deleted_at", null)
        .eq("visibility", "public")
        .order("member_count", { ascending: false })
        .limit(60);
      return (data ?? []) as unknown as GroupCardData[];
    },
  });


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

  return (
    <main className="mx-auto max-w-7xl pb-20">
      {seedToken && !user && seedInfo && (
        <div className="px-4 md:px-6">
          <GroupSeedJoinPrompt
            groupName={seedInfo.group_name}
            groupSlug={seedInfo.group_slug}
            token={seedToken}
          />
        </div>
      )}

      <div className="space-y-4">
        <GroupHero group={group} nextEvent={nextEvent} />

        <GroupNewsTicker groupId={group.id} />

        <div className="px-4 md:px-6">
          <GroupTabBar
            tab={tab}
            setTab={setTab}
            slug={group.slug}
            counts={{
              collab: group.collab_count,
              work: group.work_count,
              workshops: group.workshop_count,
              members: group.member_count,
            }}
            childCount={childGroups.length}
          />

        <div className="mt-5">

          {tab === "today" && <GroupTodayTab group={group} />}
          {tab === "events" && <GroupEventsTab group={group} />}
          {tab === "work" && <GroupWorkTab group={group} />}
          {tab === "collab" && <GroupCollabTab group={group} />}
          {tab === "workshops" && <GroupWorkshopTab group={group} />}
          {tab === "subgroups" && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {childGroups.map((g) => (
                <GroupCard key={g.id} group={g} />
              ))}
            </div>
          )}
          {tab === "members" && <GroupMembersTab group={group} />}
          {tab === "about" && <GroupAboutTab group={group} />}
        </div>

        <div className="mt-16">
          <AdjacentGroupsRail groupId={group.id} />
        </div>
      </div>
      </div>
    </main>

  );
}


function GroupEventsTab({ group }: { group: GroupRow }) {
  const { user } = useAuth();
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });
  const { data: events, isLoading } = useQuery({
    queryKey: ["group", group.id, "events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_events")
        .select("id,slug,title,tagline,kind,format,cover_url,accent_color,starts_at,venue_name,venue_address,going_count,capacity,featured_at,promo_pass_months")
        .eq("group_id", group.id)
        .is("deleted_at", null)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const now = new Date();
  const upcoming = (events ?? []).filter((e) => new Date(e.starts_at) >= now);
  const past = (events ?? []).filter((e) => new Date(e.starts_at) < now);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-ink">Upcoming events</h3>
        {isAdmin && (
          <Link to="/admin/events" className="text-xs text-primary hover:underline">+ Create event (admin)</Link>
        )}
      </div>
      {isLoading && <p className="text-sm text-ink-muted">Loading…</p>}
      {!isLoading && upcoming.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-ink-muted">
          No upcoming events yet. Your scene's quiet — RSVP first when one drops.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {upcoming.map((e) => (
          <EventCardLite key={e.id} groupSlug={group.slug} ev={e as EventLite} />
        ))}
      </div>
      {past.length > 0 && (
        <details className="rounded-2xl border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium text-ink-soft">Past events ({past.length})</summary>
          <ul className="mt-3 space-y-2">
            {past.map((e) => (
              <li key={e.id}>
                <Link to="/g/$slug/e/$eventSlug" params={{ slug: group.slug, eventSlug: e.slug }} className="text-sm text-ink-soft hover:text-ink">
                  · {e.title} <span className="text-ink-muted">— {new Date(e.starts_at).toLocaleDateString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

type EventLite = {
  id: string; slug: string; title: string; tagline: string | null; kind: string;
  format: "in_person" | "online" | "hybrid"; cover_url: string | null;
  starts_at: string; venue_name: string | null; venue_address: string | null;
  going_count: number; capacity: number | null; featured_at: string | null; promo_pass_months: number;
};

function EventCardLite({ groupSlug, ev }: { groupSlug: string; ev: EventLite }) {
  const starts = new Date(ev.starts_at);
  return (
    <Link
      to="/g/$slug/e/$eventSlug"
      params={{ slug: groupSlug, eventSlug: ev.slug }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div
        className={cn("relative h-32 w-full", ev.cover_url ? "bg-cover bg-center" : "gradient-motion")}
        style={ev.cover_url ? { backgroundImage: `url(${ev.cover_url})` } : undefined}
      >
        <div className="absolute left-3 top-3 rounded-xl bg-background/90 px-2 py-1 text-center shadow-soft">
          <div className="text-[9px] font-medium uppercase text-ink-muted">{starts.toLocaleDateString(undefined, { month: "short" })}</div>
          <div className="font-display text-base leading-none text-ink">{starts.getDate()}</div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h4 className="font-display text-sm text-ink line-clamp-2">{ev.title}</h4>
        <div className="text-[11px] text-ink-muted">
          {starts.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          {" · "}
          {ev.format === "online" ? "Online" : (ev.venue_name ?? ev.venue_address ?? "TBA")}
        </div>
        <div className="mt-auto flex items-center justify-between pt-1 text-[11px]">
          <span className="text-ink-muted">{ev.going_count} going{ev.capacity ? ` / ${ev.capacity}` : ""}</span>
          {ev.promo_pass_months > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">+{ev.promo_pass_months}mo Plus</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function GroupAboutTab({ group }: { group: GroupRow }) {
  return (
    <div className="space-y-8">
      <div className="prose prose-sm max-w-3xl text-ink">
        {group.description ? (
          <p className="whitespace-pre-wrap text-ink">{group.description}</p>
        ) : (
          <p className="text-ink-muted">No description yet.</p>
        )}
      </div>
      <GroupNewsFeedSetting group={group} />
    </div>
  );
}

/** Owner/steward-only control to set the group's news ticker source. */
function GroupNewsFeedSetting({ group }: { group: GroupRow }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const setFeed = useServerFn(setGroupNewsFeed);
  const [url, setUrl] = useState(group.news_feed_url ?? "");

  const { data: canEdit } = useQuery({
    queryKey: ["group-role", group.id, user?.id ?? "anon"],
    enabled: !!user,
    queryFn: async () => {
      const [memberRes, adminRes] = await Promise.all([
        supabase
          .from("group_members")
          .select("role")
          .eq("group_id", group.id)
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" }),
      ]);
      const role = (memberRes.data as { role?: string } | null)?.role;
      const isAdmin = adminRes.data === true;
      return isAdmin || role === "owner" || role === "steward";
    },
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = url.trim();
      await setFeed({
        data: { group_id: group.id, news_feed_url: trimmed ? trimmed : null },
      });
    },
    onSuccess: () => {
      toast.success("News feed updated");
      qc.invalidateQueries({ queryKey: ["group", group.slug] });
      qc.invalidateQueries({ queryKey: ["group", group.id, "news"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canEdit) return null;

  return (
    <section className="max-w-3xl rounded-3xl border border-border bg-surface p-4">
      <h3 className="font-display text-base text-ink">News feed</h3>
      <p className="mt-1 text-xs text-ink-muted">
        Paste a Google News RSS URL (news.google.com/rss/search?q=…) — text
        headlines only, scrolled as a ticker above the tabs. Leave blank to
        hide the ticker.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://news.google.com/rss/search?q=…"
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70 focus:border-ring focus:outline-none"
        />
        <Button
          type="button"
          size="sm"
          onClick={() => save.mutate()}
          disabled={save.isPending || url.trim() === (group.news_feed_url ?? "")}
        >
          Save
        </Button>
      </div>
    </section>
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
        <GroupEmpty
          title="No Work in this Group yet."
          hint="Tag a piece from your portfolio so it shows up here."
          action={
            <Button asChild size="sm" className="rounded-full">
              <Link to="/works/new" search={{ group: group.slug }}>
                <Plus className="h-4 w-4" /> Add Work
              </Link>
            </Button>
          }
        />

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
        .select("collab:collab_posts(id,title,slug,description,status,resulting_work_id)")
        .eq("group_id", group.id)
        .limit(48);
      return (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.collab)
        .filter((c: (CollabRow & { status?: string; resulting_work_id?: string | null }) | null) =>
          !!c && (c.status === "open" || (c.status === "closed" && !!c.resulting_work_id)),
        ) as CollabRow[];
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
        <GroupEmpty
          title="No Collabs yet."
          hint="Post the first one — it shows up across Workshop."
          action={
            <Button asChild size="sm" className="rounded-full">
              <Link to="/collab/new" search={{ group: group.slug }}>
                <Plus className="h-4 w-4" /> Post a Collab
              </Link>
            </Button>
          }
        />

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
        <GroupEmpty
          title="No Workshops yet."
          hint="Start a Workshop tied to this Group."
          action={
            <Button asChild size="sm" className="rounded-full">
              <Link to="/workshops/new" search={{ group: group.slug }}>
                <Plus className="h-4 w-4" /> Start a Workshop
              </Link>
            </Button>
          }
        />

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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:bg-muted">
          <Link
            to="/u/$username"
            params={{ username: m.username ?? "" }}
            className="flex min-w-0 flex-1 items-center gap-3"
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
          <MessageButton otherUserId={m.id} />
        </div>
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
