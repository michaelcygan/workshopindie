import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, X, Search, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABELS, type Category } from "@/lib/categories";
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
import { setGroupNewsFeed, setGroupParent } from "@/lib/group-admin.functions";



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


const TAB_VALUES = ["today", "collab", "work", "events", "members", "subgroups", "about"] as const;
type TabValue = (typeof TAB_VALUES)[number];


export const Route = createFileRoute("/g/$slug")({
  validateSearch: (s: Record<string, unknown>) => ({
    j: typeof s.j === "string" ? s.j : undefined,
    t:
      typeof s.t === "string" && (TAB_VALUES as readonly string[]).includes(s.t)
        ? (s.t as TabValue)
        : undefined,
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
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [] };
    const title = `${loaderData.name} — Group on Workshop`;
    const desc = loaderData.tagline ?? loaderData.description ?? "Join this Group on Workshop.";
    const url = `https://workshopindie.com/g/${params.slug}`;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: loaderData.name,
      description: desc,
      url,
      ...(loaderData.cover_url ? { image: loaderData.cover_url } : {}),
      isPartOf: { "@type": "WebSite", name: "Workshop", url: "https://workshopindie.com" },
    };
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        ...(loaderData.cover_url ? [{ property: "og:image", content: loaderData.cover_url }] : []),
        { name: "twitter:card", content: loaderData.cover_url ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        ...(loaderData.cover_url ? [{ name: "twitter:image", content: loaderData.cover_url }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(jsonLd),
        },
      ],
    };
  },
});


type Tab = GroupTab;

function GroupPage() {
  const group = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Today is the default landing surface; ?t= deep-links to a specific tab.
  const tab: Tab = (search.t as Tab | undefined) ?? "today";
  const setTab = (next: Tab) => {
    navigate({
      to: "/g/$slug",
      params: { slug: group.slug },
      search: (prev: { j?: string; t?: TabValue }) => ({
        ...prev,
        t: next === "today" ? undefined : (next as TabValue),
      }),

      replace: true,
    });
  };



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

  // Cheap count-only query so the tab bar can show the Subgroups chip
  // without paying for the full row payload on every page load.
  const { data: childCount = 0 } = useQuery({
    queryKey: ["group", group.id, "children-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("groups")
        .select("id", { count: "exact", head: true })
        .eq("parent_group_id", group.id)
        .is("deleted_at", null)
        .eq("visibility", "public");
      return count ?? 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Full child-group payload — only fetched when the Subgroups tab is opened.
  const { data: childGroups = [] } = useQuery({
    enabled: tab === "subgroups" && childCount > 0,
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
              members: group.member_count,
            }}
            childCount={childCount}
          />

        <div className="mt-5">

          {tab === "today" && <GroupTodayTab group={group} />}
          {tab === "collab" && <GroupCollabTab group={group} />}

          {tab === "work" && <GroupWorkTab group={group} />}
          {tab === "events" && <GroupEventsTab group={group} />}
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
        .select("id,slug,title,tagline,kind,format,cover_url,accent_color,starts_at,venue_name,venue_address,going_count,capacity,featured_at,promo_pass_months,source,external_url,external_organizer,is_recurring,recurrence_label,pinned_at,online_url")
        .eq("group_id", group.id)
        .is("deleted_at", null)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EventLite[];
    },
  });
  const now = new Date();
  const all = events ?? [];
  const pinnedOrRecurring = all
    .filter((e) => e.pinned_at || e.is_recurring)
    .sort((a, b) => {
      if (!!b.pinned_at !== !!a.pinned_at) return b.pinned_at ? 1 : -1;
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    });
  const pinnedIds = new Set(pinnedOrRecurring.map((e) => e.id));
  const upcoming = all.filter((e) => !pinnedIds.has(e.id) && new Date(e.starts_at) >= now);
  const past = all.filter((e) => !pinnedIds.has(e.id) && new Date(e.starts_at) < now);

  const isCity = group.kind === "city";
  const subheading = isCity
    ? "Open mics, screenings, workshops, meetups, and other places to connect."
    : "Gatherings, workshops, and events connected to this community.";

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-ink md:text-3xl">Events in {group.name}</h3>
          <p className="mt-1 text-sm text-ink-muted">{subheading}</p>
        </div>
        {isAdmin && (
          <Link
            to="/admin/events"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft shadow-soft hover:bg-muted"
          >
            + Add event
          </Link>
        )}
      </header>

      {isLoading && <p className="text-sm text-ink-muted">Loading…</p>}

      {!isLoading && pinnedOrRecurring.length > 0 && (
        <section className="space-y-3">
          <h4 className="font-display text-lg text-ink">Pinned &amp; recurring</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedOrRecurring.map((e) => (
              <EventCardLite key={e.id} groupSlug={group.slug} ev={e} />
            ))}
          </div>
        </section>
      )}

      {!isLoading && upcoming.length > 0 && (
        <section className="space-y-3">
          <h4 className="font-display text-lg text-ink">Upcoming</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => (
              <EventCardLite key={e.id} groupSlug={group.slug} ev={e} />
            ))}
          </div>
        </section>
      )}

      {!isLoading && pinnedOrRecurring.length === 0 && upcoming.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-ink-muted">
          The calendar is quiet for now. New events will appear here as they are added.
        </p>
      )}

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
  source: "workshop" | "external" | null;
  external_url: string | null;
  external_organizer: string | null;
  is_recurring: boolean | null;
  recurrence_label: string | null;
  pinned_at: string | null;
  online_url: string | null;
};

function EventCardLite({ groupSlug, ev }: { groupSlug: string; ev: EventLite }) {
  const starts = new Date(ev.starts_at);
  const isExternal = ev.source === "external" && !!ev.external_url;
  const isOnline = ev.format === "online" || ev.format === "hybrid";
  const locationLine = isOnline
    ? "Online"
    : (ev.venue_name ?? ev.venue_address ?? "TBA");

  const Inner = (
    <>
      <div
        className={cn("relative h-32 w-full", ev.cover_url ? "bg-cover bg-center" : "gradient-motion")}
        style={ev.cover_url ? { backgroundImage: `url(${ev.cover_url})` } : undefined}
      >
        <div className="absolute left-3 top-3 rounded-xl bg-background/90 px-2 py-1 text-center shadow-soft">
          <div className="text-[9px] font-medium uppercase text-ink-muted">{starts.toLocaleDateString(undefined, { month: "short" })}</div>
          <div className="font-display text-base leading-none text-ink">{starts.getDate()}</div>
        </div>
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
          {ev.pinned_at && (
            <span className="rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-ink shadow-soft">Pinned</span>
          )}
          {ev.is_recurring && (
            <span className="rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow-soft">
              {ev.recurrence_label || "Recurring"}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h4 className="font-display text-sm text-ink line-clamp-2">{ev.title}</h4>
        <div className="text-[11px] text-ink-muted">
          {starts.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          {" · "}
          {locationLine}
        </div>
        <div className="mt-auto flex items-center justify-between pt-1 text-[11px]">
          <span className="text-ink-muted">
            {isExternal
              ? `External${ev.external_organizer ? ` · ${ev.external_organizer}` : ""}`
              : `${ev.going_count} going${ev.capacity ? ` / ${ev.capacity}` : ""}`}
          </span>
          {isExternal ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">View event ↗</span>
          ) : ev.promo_pass_months > 0 ? (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">+{ev.promo_pass_months}mo Plus</span>
          ) : null}
        </div>
      </div>
    </>
  );

  if (isExternal) {
    return (
      <a
        href={ev.external_url!}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
      >
        {Inner}
      </a>
    );
  }

  return (
    <Link
      to="/g/$slug/e/$eventSlug"
      params={{ slug: groupSlug, eventSlug: ev.slug }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      {Inner}
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
      <GroupSubgroupsSection group={group} />
      <GroupNewsFeedSetting group={group} />
    </div>
  );
}

type ChildGroupLite = {
  id: string;
  slug: string;
  name: string;
  kind: GroupRow["kind"];
  avatar_url: string | null;
  member_count: number;
};

function GroupSubgroupsSection({ group }: { group: GroupRow }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const setParent = useServerFn(setGroupParent);

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });

  const { data: children = [] } = useQuery({
    queryKey: ["group", group.id, "about-children"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id,slug,name,kind,avatar_url,member_count")
        .eq("parent_group_id", group.id)
        .order("member_count", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ChildGroupLite[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["group", group.id, "about-children"] });
    qc.invalidateQueries({ queryKey: ["group", group.id, "children-count"] });
    qc.invalidateQueries({ queryKey: ["group", group.id, "children"] });
  };

  const unlink = useMutation({
    mutationFn: (childId: string) =>
      setParent({ data: { id: childId, parent_group_id: null } }),
    onSuccess: () => {
      toast.success("Subgroup unlinked");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (children.length === 0 && !isAdmin) return null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base text-ink">
          Subgroups{children.length > 0 ? ` (${children.length})` : ""}
        </h3>
        {children.length > 6 && (
          <Link
            to="/g/$slug"
            params={{ slug: group.slug }}
            search={{ t: "subgroups" }}
            className="text-xs text-primary hover:underline"
          >
            See all →
          </Link>
        )}
      </div>

      {children.length === 0 ? (
        <p className="text-sm text-ink-muted">No subgroups yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {children.slice(0, 12).map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-2"
            >
              <Link
                to="/g/$slug"
                params={{ slug: c.slug }}
                className="flex flex-1 items-center gap-3 min-w-0"
              >
                <Avatar className="h-9 w-9">
                  {c.avatar_url && <AvatarImage src={c.avatar_url} alt="" />}
                  <AvatarFallback>{c.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{c.name}</div>
                  <div className="text-[11px] text-ink-muted">
                    {c.member_count} member{c.member_count === 1 ? "" : "s"}
                  </div>
                </div>
              </Link>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] text-ink-muted hover:text-destructive"
                  disabled={unlink.isPending}
                  onClick={() => unlink.mutate(c.id)}
                >
                  Unlink
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && <GroupSubgroupAttacher group={group} onChanged={invalidate} />}
    </section>
  );
}

function GroupSubgroupAttacher({
  group,
  onChanged,
}: {
  group: GroupRow;
  onChanged: () => void;
}) {
  const setParent = useServerFn(setGroupParent);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["group-attacher-search", group.id, debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id,slug,name,kind,parent_group_id")
        .ilike("name", `%${debounced}%`)
        .is("parent_group_id", null)
        .neq("id", group.id)
        .neq("kind", "city")
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const attach = useMutation({
    mutationFn: (childId: string) =>
      setParent({ data: { id: childId, parent_group_id: group.id } }),
    onSuccess: () => {
      toast.success("Subgroup attached");
      setQ("");
      setDebounced("");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-4 rounded-xl border border-dashed border-border bg-background/60 p-3">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
        Admin · attach subgroup
      </div>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search top-level groups by name…"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />
      {debounced.length >= 2 && (
        <ul className="mt-2 space-y-1">
          {isFetching && <li className="text-xs text-ink-muted">Searching…</li>}
          {!isFetching && results.length === 0 && (
            <li className="text-xs text-ink-muted">No matches.</li>
          )}
          {results.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-surface"
            >
              <div className="min-w-0">
                <div className="truncate text-sm text-ink">{r.name}</div>
                <div className="text-[11px] text-ink-muted">{r.kind} · /g/{r.slug}</div>
              </div>
              <Button
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={attach.isPending}
                onClick={() => attach.mutate(r.id)}
              >
                Attach
              </Button>
            </li>
          ))}
        </ul>
      )}
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
type WorkAuthor = { username: string | null; display_name: string | null; avatar_url: string | null };
type WorkRow = {
  id: string; title: string; slug: string; cover_url: string | null;
  category: Category | null;
  published_at: string | null;
  author: WorkAuthor | null;
};

function GroupWorkTab({ group }: { group: GroupRow }) {
  const [sort, setSort] = useState<"recent" | "trending">("recent");
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data: works = [], isLoading } = useQuery({
    queryKey: ["group", group.id, "works"],
    queryFn: async (): Promise<WorkRow[]> => {
      const { data } = await supabase
        .from("group_works")
        .select("work:works(id,title,slug,cover_url,category,published_at, author:profiles!works_created_by_fkey(username,display_name,avatar_url))")
        .eq("group_id", group.id)
        .limit(48);
      return (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.work)
        .filter((w: WorkRow | null) => !!w && w.published_at) as WorkRow[];
    },
  });

  const filtered = (() => {
    const query = q.trim().toLowerCase();
    let list = query ? works.filter((w) => w.title.toLowerCase().includes(query)) : works.slice();
    const now = Date.now();
    if (sort === "trending") {
      list.sort((a, b) => {
        const ap = a.published_at ? Date.parse(a.published_at) : 0;
        const bp = b.published_at ? Date.parse(b.published_at) : 0;
        const aRecent = now - ap < 30 * 24 * 60 * 60 * 1000 ? 1 : 0;
        const bRecent = now - bp < 30 * 24 * 60 * 60 * 1000 ? 1 : 0;
        if (aRecent !== bRecent) return bRecent - aRecent;
        return bp - ap;
      });
    } else {
      list.sort((a, b) => {
        const ap = a.published_at ? Date.parse(a.published_at) : 0;
        const bp = b.published_at ? Date.parse(b.published_at) : 0;
        return bp - ap;
      });
    }
    return list;
  })();

  return (
    <div>
      <AddMineToGroup group={group} entity="work" />

      {/* Utility strip */}
      <div className="mt-3 flex items-center justify-end gap-1 text-ink-muted">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs hover:bg-surface-2">
              {sort === "trending" ? "Trending" : "Recent"}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => setSort("recent")}>Recent</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort("trending")}>Trending</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {searchOpen ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setQ(""); setSearchOpen(false); } }}
              onBlur={() => { if (!q) setSearchOpen(false); }}
              placeholder={`Search in ${group.name}…`}
              className="h-8 w-[200px] text-xs"
            />
            {q && (
              <button
                onClick={() => { setQ(""); setSearchOpen(false); }}
                className="rounded-full p-1 hover:bg-surface-2"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="rounded-full p-1.5 hover:bg-surface-2"
            aria-label={`Search in ${group.name}`}
          >
            <Search className="h-4 w-4" />
          </button>
        )}
      </div>

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
                <Plus className="h-4 w-4" /> Add a piece
              </Link>
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <div className="mt-8 text-center text-sm text-ink-muted">
          No Works match “{q}”.{" "}
          <button onClick={() => { setQ(""); setSearchOpen(false); }} className="underline hover:text-ink">Clear</button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => {
            const author = w.author;
            const authorName = author?.display_name || author?.username || "";
            const initials = (authorName || "?").slice(0, 1).toUpperCase();
            return (
              <Link
                key={w.id}
                to="/works/$slug"
                params={{ slug: w.slug }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="relative h-32 w-full overflow-hidden">
                  <div
                    className={cn(
                      "absolute inset-0 transition-transform duration-300 group-hover:scale-[1.03]",
                      w.cover_url ? "bg-cover bg-center" : "bg-surface-2",
                    )}
                    style={w.cover_url ? { backgroundImage: `url(${w.cover_url})` } : undefined}
                  />
                  {w.category && CATEGORY_LABELS[w.category] && (
                    <span
                      aria-hidden
                      className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur"
                    >
                      {CATEGORY_LABELS[w.category]}
                    </span>
                  )}
                  {author?.username && (
                    <Link
                      to="/u/$username"
                      params={{ username: author.username }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`View ${authorName || author.username}'s profile`}
                      className="absolute -bottom-3 left-3 z-10"
                    >
                      <Avatar className="h-7 w-7 ring-2 ring-background">
                        {author.avatar_url && <AvatarImage src={author.avatar_url} alt="" />}
                        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                      </Avatar>
                    </Link>
                  )}
                </div>
                <div className="p-3 pt-4">
                  <div className="font-display text-base text-ink line-clamp-2">{w.title}</div>
                  {authorName && (
                    <div className="mt-0.5 text-xs text-ink-muted">by {authorName}</div>
                  )}
                </div>
              </Link>
            );
          })}
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




/* ---------- MEMBERS ---------- */
function GroupMembersTab({ group }: { group: GroupRow }) {
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["group", group.id, "members"],
    queryFn: async () => {
      const { data: gm } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", group.id)
        .limit(200);
      const ids = (gm ?? []).map((r) => r.user_id as string);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,hide_group_memberships")
        .in("id", ids);
      return (profs ?? []).filter((p) => !p.hide_group_memberships) as {
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

  const labelMap = { work: "Work", collab: "Collab", workshop: "Lounge" };

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
