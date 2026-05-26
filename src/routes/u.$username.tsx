import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, ExternalLink, Pencil, Plus, Link2, Users, Calendar, Layers } from "lucide-react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WorkCard, type WorkCardData } from "@/components/work-card";
import { CategoryChip } from "@/components/category-chip";
import { FollowButton } from "@/components/follow-button";
import { ReportDialog } from "@/components/report-dialog";
import { BlockButton } from "@/components/block-button";
import { CreatorBadge } from "@/components/creator-badge";
import { ProfilePeek } from "@/components/profile-peek";
import { getFrequentCollaborators, type Collaborator } from "@/lib/network.functions";
import { useDocumentMeta, useJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { CATEGORIES, type Category } from "@/lib/categories";

const TAB_VALUES = ["works", "credits", "collabs", "workshops", "groups", "about"] as const;
type ProfileTab = typeof TAB_VALUES[number];

const profileSearch = z.object({
  tab: z.enum(TAB_VALUES).optional(),
});

export const Route = createFileRoute("/u/$username")({
  component: ProfilePage,
  validateSearch: zodValidator(profileSearch),
  loader: async ({ params }) => {
    const { getProfileSeo } = await import("@/lib/seo-loaders.functions");
    const data = await getProfileSeo({ data: { username: params.username } });
    return { seo: data };
  },
  head: ({ params, loaderData }) => {
    const p = loaderData?.seo;
    const url = `https://workshopindie.com/u/${params.username}`;
    const name = p?.display_name ?? p?.username ?? params.username;
    const title = `${name} — Workshop`;
    const description = p?.headline ?? p?.bio?.slice(0, 160) ?? `${name}'s profile on Workshop.`;
    const meta = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" as const },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (p?.avatar_url) {
      meta.push({ property: "og:image", content: p.avatar_url });
      meta.push({ name: "twitter:image", content: p.avatar_url });
    }
    return { meta, links: [{ rel: "canonical", href: url }] };
  },
});

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  headline: string | null;
  categories: Category[];
  external_links: { label: string; url: string }[] | null;
  instagram_handle: string | null;
  follower_count: number;
  following_count: number;
  work_count: number;
  worked_with_count: number;
  creator_status: string;
  pinned_work_ids: string[];
  aliases: string[] | null;
  city: { name: string; country: string; slug: string } | null;
  home_city: { name: string; country: string; slug: string } | null;
};

async function fetchProfile(username: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,cover_url,bio,headline,categories,external_links,instagram_handle,follower_count,following_count,work_count,worked_with_count,creator_status,pinned_work_ids,aliases,city:cities!profiles_city_id_fkey(name,country,slug),home_city:cities!profiles_home_city_id_fkey(name,country,slug)")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Profile) ?? null;
}

type OwnedWork = WorkCardData;
type CreditWork = WorkCardData & { my_role: string; owner: { id: string; display_name: string | null; username: string | null } | null };

async function fetchOwnedWorks(userId: string): Promise<OwnedWork[]> {
  const { data, error } = await supabase
    .from("works")
    .select("id,title,slug,category,cover_url,embed_url,source_type,like_count,save_count,view_count,published_at,created_at, work_credits(role_label,sort_order, profiles(id,display_name,username))")
    .eq("created_by", userId)
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  type Row = {
    id: string; title: string; slug: string; category: Category;
    cover_url: string | null; embed_url: string | null; source_type: string;
    like_count: number; save_count: number; view_count: number;
    work_credits?: { sort_order: number; profiles: { id: string; display_name: string | null; username: string | null } | null }[];
  };
  return ((data ?? []) as Row[]).map<OwnedWork>((r) => ({
    id: r.id, title: r.title, slug: r.slug, category: r.category,
    cover_url: r.cover_url, embed_url: r.embed_url, source_type: r.source_type,
    like_count: r.like_count, save_count: r.save_count, view_count: r.view_count,
    credits: (r.work_credits ?? []).sort((a, b) => a.sort_order - b.sort_order).map((c) => ({
      id: c.profiles?.id ?? null,
      display_name: c.profiles?.display_name ?? null,
      username: c.profiles?.username ?? null,
    })),
  }));
}

async function fetchCreditedWorks(userId: string): Promise<CreditWork[]> {
  const { data, error } = await supabase
    .from("work_credits")
    .select("role_label, work:works!inner(id,title,slug,category,cover_url,embed_url,source_type,like_count,save_count,view_count,published_at,created_at,status,visibility,created_by, owner:profiles!works_created_by_fkey(id,display_name,username), work_credits(role_label,sort_order, profiles(id,display_name,username)))")
    .eq("user_id", userId)
    .eq("hidden_from_profile", false);
  if (error) throw error;
  type Row = {
    role_label: string;
    work: {
      id: string; title: string; slug: string; category: Category;
      cover_url: string | null; embed_url: string | null; source_type: string;
      like_count: number; save_count: number; view_count: number;
      status: string; visibility: string; created_by: string;
      owner: { id: string; display_name: string | null; username: string | null } | null;
      work_credits?: { sort_order: number; profiles: { id: string; display_name: string | null; username: string | null } | null }[];
    };
  };
  const rows = (data as unknown as Row[]).filter((r) =>
    r.work
    && r.work.status === "published"
    && (r.work.visibility === "public" || r.work.visibility === "unlisted")
    && r.work.created_by !== userId,
  );
  const seen = new Map<string, CreditWork>();
  for (const r of rows) {
    if (seen.has(r.work.id)) continue;
    seen.set(r.work.id, {
      id: r.work.id, title: r.work.title, slug: r.work.slug, category: r.work.category,
      cover_url: r.work.cover_url, embed_url: r.work.embed_url, source_type: r.work.source_type,
      like_count: r.work.like_count, save_count: r.work.save_count, view_count: r.work.view_count,
      my_role: r.role_label,
      owner: r.work.owner,
      credits: (r.work.work_credits ?? []).sort((a, b) => a.sort_order - b.sort_order).map((c) => ({
        id: c.profiles?.id ?? null,
        display_name: c.profiles?.display_name ?? null,
        username: c.profiles?.username ?? null,
      })),
    });
  }
  return [...seen.values()];
}

type CollabRow = { id: string; title: string; slug: string; category: Category; description: string | null; created_at: string };
async function fetchOpenCollabs(userId: string): Promise<CollabRow[]> {
  const { data } = await supabase
    .from("collab_posts")
    .select("id,title,slug,category,description,created_at")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  return (data ?? []) as CollabRow[];
}

type WorkshopRow = { id: string; title: string; slug: string; category: Category; starts_at: string | null; status: string; role: "host" | "participant" };
async function fetchWorkshops(userId: string): Promise<WorkshopRow[]> {
  const [hosted, joined] = await Promise.all([
    supabase.from("workshops").select("id,title,slug,category,starts_at,status").eq("host_user_id", userId).in("visibility", ["public", "unlisted"]).order("starts_at", { ascending: false, nullsFirst: false }),
    supabase.from("workshop_participants").select("workshop:workshops!inner(id,title,slug,category,starts_at,status,visibility)").eq("user_id", userId).in("participant_status", ["confirmed", "checked_in", "completed"]),
  ]);
  const out: WorkshopRow[] = [];
  for (const w of (hosted.data ?? []) as { id: string; title: string; slug: string; category: string; starts_at: string | null; status: string }[]) {
    out.push({ id: w.id, title: w.title, slug: w.slug, category: w.category as Category, starts_at: w.starts_at, status: w.status, role: "host" });
  }
  for (const row of (joined.data ?? []) as { workshop: { id: string; title: string; slug: string; category: string; starts_at: string | null; status: string; visibility: string } }[]) {
    const w = row.workshop;
    if (!w || (w.visibility !== "public" && w.visibility !== "unlisted")) continue;
    if (out.some((x) => x.id === w.id)) continue;
    out.push({ id: w.id, title: w.title, slug: w.slug, category: w.category as Category, starts_at: w.starts_at, status: w.status, role: "participant" });
  }
  return out.sort((a, b) => (b.starts_at ?? "").localeCompare(a.starts_at ?? ""));
}

function ProfilePage() {
  const { username } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery({ queryKey: ["profile", username], queryFn: () => fetchProfile(username) });
  const { data: ownedWorks } = useQuery({
    queryKey: ["profile-owned", profile?.id],
    queryFn: () => fetchOwnedWorks(profile!.id),
    enabled: !!profile?.id,
  });
  const { data: creditedWorks } = useQuery({
    queryKey: ["profile-credits", profile?.id],
    queryFn: () => fetchCreditedWorks(profile!.id),
    enabled: !!profile?.id,
  });
  const { data: openCollabs } = useQuery({
    queryKey: ["profile-collabs", profile?.id],
    queryFn: () => fetchOpenCollabs(profile!.id),
    enabled: !!profile?.id,
  });
  const { data: workshops } = useQuery({
    queryKey: ["profile-workshops", profile?.id],
    queryFn: () => fetchWorkshops(profile!.id),
    enabled: !!profile?.id,
  });

  useDocumentMeta({
    title: profile ? (profile.display_name || profile.username || "Creator") : undefined,
    description: profile?.headline ?? profile?.bio?.slice(0, 160) ?? undefined,
    image: profile?.avatar_url ?? profile?.cover_url ?? undefined,
    type: "profile",
  });
  useJsonLd(profile ? {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.display_name ?? profile.username ?? "Creator",
    alternateName: profile.username ?? undefined,
    description: profile.headline ?? profile.bio ?? undefined,
    image: profile.avatar_url ?? undefined,
  } : null);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="h-48 animate-pulse rounded-3xl bg-surface-2" />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-4xl text-ink">Profile not found</h1>
        <p className="mt-2 text-ink-muted">No creator with the handle <span className="font-mono">@{username}</span>.</p>
        <Link to="/" className="mt-6 inline-block"><Button variant="outline" className="rounded-full">Back to gallery</Button></Link>
      </main>
    );
  }

  const isOwn = user?.id === profile.id;
  const name = profile.display_name || profile.username || "Creator";

  const counts: Record<ProfileTab, number> = {
    works: ownedWorks?.length ?? 0,
    credits: creditedWorks?.length ?? 0,
    collabs: openCollabs?.length ?? 0,
    workshops: workshops?.length ?? 0,
    groups: (profile.home_city ? 1 : 0) + (profile.city && profile.city.slug !== profile.home_city?.slug ? 1 : 0),
    about: 1,
  };

  // Default tab: own → works; other → first non-empty tab (works > credits > collabs > workshops > groups > about)
  const defaultTab: ProfileTab = (() => {
    if (search.tab) return search.tab;
    if (isOwn) return "works";
    const order: ProfileTab[] = ["works", "credits", "collabs", "workshops", "groups", "about"];
    return order.find((t) => counts[t] > 0) ?? "about";
  })();

  const setTab = (t: ProfileTab) => navigate({ to: "/u/$username", params: { username }, search: { tab: t }, replace: true });

  const visibleTabs: ProfileTab[] = TAB_VALUES.filter((t) => {
    if (t === "works" || t === "about") return true;
    if (t === "credits") return counts.credits > 0;
    if (t === "collabs") return counts.collabs > 0 || isOwn;
    if (t === "workshops") return counts.workshops > 0;
    if (t === "groups") return counts.groups > 0;
    return true;
  });

  return (
    <main>
      {/* Cover */}
      <div className="relative h-48 overflow-hidden bg-surface-2 md:h-64">
        {profile.cover_url ? (
          <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full gradient-warm opacity-70" />
        )}
      </div>

      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <div className="-mt-12 flex flex-col gap-5 md:-mt-16 md:flex-row md:items-end md:gap-6">
          <Avatar className="h-24 w-24 ring-4 ring-background md:h-32 md:w-32">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-2xl">{name[0]}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-3xl text-ink md:text-4xl">{name}</h1>
              <CreatorBadge status={profile.creator_status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              {profile.username && <span>@{profile.username}</span>}
              {profile.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{profile.city.name}</span>}
              {profile.instagram_handle && (
                <a
                  href={`https://instagram.com/${profile.instagram_handle}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-gradient-motion hover:underline"
                >
                  IG @{profile.instagram_handle}
                </a>
              )}
            </div>
            {profile.headline && <p className="mt-2 text-ink-soft">{profile.headline}</p>}
            {profile.aliases && profile.aliases.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                <span>also known as</span>
                {profile.aliases.map((a, i) => (
                  <span key={i} className="rounded-full border border-border bg-surface px-2 py-0.5 text-ink-soft">
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isOwn ? (
              <>
                <Button variant="outline" className="rounded-full gap-1.5" onClick={() => navigate({ to: "/me/edit" })}>
                  <Pencil className="h-4 w-4" /> Edit profile
                </Button>
                <Button variant="outline" className="rounded-full gap-1.5" onClick={() => navigate({ to: "/works/new" })}>
                  <Link2 className="h-4 w-4" /> Drop a link
                </Button>
                <Button className="rounded-full gap-1.5" onClick={() => navigate({ to: "/works/new", search: { manual: true } })}>
                  <Plus className="h-4 w-4" /> Publish a Work
                </Button>
              </>
            ) : (
              <>
                <FollowButton targetUserId={profile.id} />
                <ReportDialog entityType="profile" entityId={profile.id} />
                <BlockButton targetUserId={profile.id} />
              </>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border border-border bg-surface px-5 py-4 text-sm">
          <Stat label="Works" value={counts.works} />
          <Stat label="Credits" value={counts.credits} />
          <Stat label="Worked with" value={profile.worked_with_count} />
          <Stat label="Followers" value={profile.follower_count} />
          <Stat label="Following" value={profile.following_count} />
        </div>

        {/* Tab bar */}
        <div className="sticky top-0 z-20 mt-8 -mx-4 border-b border-border bg-background/90 px-4 backdrop-blur md:-mx-6 md:px-6">
          <nav className="flex gap-1 overflow-x-auto">
            {visibleTabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "relative whitespace-nowrap px-3.5 py-3 text-sm capitalize transition",
                  defaultTab === t ? "text-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {t}{t !== "about" && t !== "groups" && (
                  <span className="ml-1.5 text-[11px] text-ink-muted">{counts[t]}</span>
                )}
                {defaultTab === t && (
                  <motion.span layoutId="profile-tab-underline" className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-ink" />
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="py-8 pb-20">
          {defaultTab === "works" && (
            <WorksTab
              works={ownedWorks ?? []}
              pinnedIds={profile.pinned_work_ids ?? []}
              isOwn={isOwn}
              ownerName={name}
              isLoading={!ownedWorks}
            />
          )}
          {defaultTab === "credits" && (
            <CreditsTab works={creditedWorks ?? []} isLoading={!creditedWorks} ownerName={name} isOwn={isOwn} />
          )}
          {defaultTab === "collabs" && (
            <CollabsTab items={openCollabs ?? []} isOwn={isOwn} ownerName={name} isLoading={!openCollabs} />
          )}
          {defaultTab === "workshops" && (
            <WorkshopsTab items={workshops ?? []} isLoading={!workshops} ownerName={name} />
          )}
          {defaultTab === "groups" && (
            <GroupsTab home={profile.home_city} city={profile.city} />
          )}
          {defaultTab === "about" && (
            <AboutTab profile={profile} />
          )}
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span className="font-display text-lg text-ink">{value}</span>{" "}
      <span className="text-ink-muted">{label}</span>
    </div>
  );
}

/* ---------------- WORKS TAB ---------------- */

function WorksTab({
  works, pinnedIds, isOwn, ownerName, isLoading,
}: {
  works: OwnedWork[];
  pinnedIds: string[];
  isOwn: boolean;
  ownerName: string;
  isLoading: boolean;
}) {
  const [activeCat, setActiveCat] = useState<Category | "all">("all");
  const pinned = pinnedIds.map((id) => works.find((w) => w.id === id)).filter(Boolean) as OwnedWork[];
  const rest = works.filter((w) => !pinnedIds.includes(w.id));

  const catCounts = useMemo(() => {
    const m = new Map<Category, number>();
    for (const w of works) m.set(w.category, (m.get(w.category) ?? 0) + 1);
    return m;
  }, [works]);
  const availableCats = useMemo(() => CATEGORIES.filter((c) => catCounts.get(c.id as Category)), [catCounts]);

  const filtered = activeCat === "all" ? rest : rest.filter((w) => w.category === activeCat);

  if (isLoading) {
    return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface-2" />)}</div>;
  }

  if (works.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-ink-muted">{isOwn ? "Your portfolio is empty. Publish your first Work." : `${ownerName} hasn't shipped a Work yet.`}</p>
        {isOwn && <Link to="/works/new" className="mt-4 inline-block"><Button className="rounded-full">Publish a Work</Button></Link>}
      </div>
    );
  }

  return (
    <>
      {pinned.length > 0 && activeCat === "all" && (
        <section className="mb-10">
          <h2 className="font-display text-xl text-ink">Pinned</h2>
          <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pinned.map((w) => <WorkCard key={w.id} work={w} />)}
          </div>
        </section>
      )}

      {availableCats.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <MediumChip active={activeCat === "all"} onClick={() => setActiveCat("all")} label="All" count={works.length} />
          {availableCats.map((c) => (
            <MediumChip
              key={c.id}
              active={activeCat === c.id}
              onClick={() => setActiveCat(c.id as Category)}
              label={c.label}
              count={catCounts.get(c.id as Category) ?? 0}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-ink-muted">
          {isOwn ? `Nothing in ${activeCat} yet. Publish one →` : "Nothing in this medium."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => <WorkCard key={w.id} work={w} />)}
        </div>
      )}
    </>
  );
}

function MediumChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted",
      )}
    >
      {label} <span className="ml-1 opacity-70">{count}</span>
    </button>
  );
}

/* ---------------- CREDITS TAB ---------------- */

function CreditsTab({ works, isLoading, ownerName, isOwn }: { works: CreditWork[]; isLoading: boolean; ownerName: string; isOwn: boolean }) {
  const [activeCat, setActiveCat] = useState<Category | "all">("all");
  const [activeRole, setActiveRole] = useState<string | "all">("all");

  const catCounts = useMemo(() => {
    const m = new Map<Category, number>();
    for (const w of works) m.set(w.category, (m.get(w.category) ?? 0) + 1);
    return m;
  }, [works]);
  const availableCats = useMemo(() => CATEGORIES.filter((c) => catCounts.get(c.id as Category)), [catCounts]);
  const availableRoles = useMemo(() => Array.from(new Set(works.map((w) => w.my_role))).sort(), [works]);

  const filtered = works.filter((w) =>
    (activeCat === "all" || w.category === activeCat)
    && (activeRole === "all" || w.my_role === activeRole),
  );

  if (isLoading) {
    return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface-2" />)}</div>;
  }

  if (works.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center text-ink-muted">
        {isOwn ? "When someone credits you on their Work, it shows up here." : `${ownerName} hasn't been credited on anyone's Work yet.`}
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-ink-muted">Work by other people that credits {isOwn ? "you" : ownerName}.</p>

      <div className="mb-3 space-y-2">
        {availableCats.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <MediumChip active={activeCat === "all"} onClick={() => setActiveCat("all")} label="All mediums" count={works.length} />
            {availableCats.map((c) => (
              <MediumChip
                key={c.id}
                active={activeCat === c.id}
                onClick={() => setActiveCat(c.id as Category)}
                label={c.label}
                count={catCounts.get(c.id as Category) ?? 0}
              />
            ))}
          </div>
        )}
        {availableRoles.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <MediumChip active={activeRole === "all"} onClick={() => setActiveRole("all")} label="All roles" count={works.length} />
            {availableRoles.map((r) => (
              <MediumChip
                key={r}
                active={activeRole === r}
                onClick={() => setActiveRole(r)}
                label={`as ${r}`}
                count={works.filter((w) => w.my_role === r).length}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((w) => (
          <div key={w.id} className="space-y-1.5">
            <WorkCard work={w} />
            <p className="px-1 text-xs text-ink-muted">
              as <span className="font-medium text-ink-soft">{w.my_role}</span>
              {w.owner?.username && (
                <> · by <Link to="/u/$username" params={{ username: w.owner.username }} className="hover:underline">@{w.owner.username}</Link></>
              )}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------- COLLABS TAB ---------------- */

function CollabsTab({ items, isOwn, ownerName, isLoading }: { items: CollabRow[]; isOwn: boolean; ownerName: string; isLoading: boolean }) {
  if (isLoading) return <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />;
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-ink-muted">{isOwn ? "No open Collabs. Post one to find collaborators." : `${ownerName} has no open Collabs.`}</p>
        {isOwn && <Link to="/collab/new" className="mt-4 inline-block"><Button className="rounded-full">Post a Collab</Button></Link>}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((c) => (
        <Link key={c.id} to="/collab/$slug" params={{ slug: c.slug }} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:shadow-soft">
          <CategoryChip category={c.category} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium text-ink">{c.title}</h3>
            {c.description && <p className="line-clamp-1 text-xs text-ink-muted">{c.description}</p>}
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Open</span>
        </Link>
      ))}
    </div>
  );
}

/* ---------------- WORKSHOPS TAB ---------------- */

function WorkshopsTab({ items, isLoading, ownerName }: { items: WorkshopRow[]; isLoading: boolean; ownerName: string }) {
  if (isLoading) return <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />;
  if (items.length === 0) {
    return <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center text-ink-muted">{ownerName} hasn't hosted or joined a Workshop yet.</div>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((w) => (
        <Link key={w.id + w.role} to="/workshops/$slug" params={{ slug: w.slug }} className="rounded-2xl border border-border bg-surface p-4 transition hover:shadow-soft">
          <div className="flex items-center gap-2">
            <CategoryChip category={w.category} />
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-ink-soft">{w.role}</span>
          </div>
          <h3 className="mt-2 font-display text-lg text-ink line-clamp-2">{w.title}</h3>
          {w.starts_at && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-muted">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(w.starts_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}

/* ---------------- GROUPS TAB ---------------- */

function GroupsTab({ home, city }: { home: { name: string; country: string; slug: string } | null; city: { name: string; country: string; slug: string } | null }) {
  const groups: { kind: "home" | "current"; name: string; country: string; slug: string }[] = [];
  if (home) groups.push({ kind: "home", ...home });
  if (city && city.slug !== home?.slug) groups.push({ kind: "current", ...city });

  if (groups.length === 0) {
    return <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center text-ink-muted">Not in any groups yet.</div>;
  }

  return (
    <>
      <p className="mb-4 text-sm text-ink-muted">Cities they're part of. More group types coming soon.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <Link key={g.slug} to="/cities/$slug" params={{ slug: g.slug }} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:shadow-soft">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-ink"><Layers className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium text-ink">{g.name}</h3>
              <p className="text-xs text-ink-muted">{g.kind === "home" ? "Home city" : "Also active in"} · {g.country}</p>
            </div>
            <Users className="h-4 w-4 text-ink-muted" />
          </Link>
        ))}
      </div>
    </>
  );
}

/* ---------------- ABOUT TAB ---------------- */

function AboutTab({ profile }: { profile: Profile }) {
  return (
    <div className="space-y-8">
      {profile.categories?.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-ink-muted">Mediums</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.categories.map((c) => <CategoryChip key={c} category={c} />)}
          </div>
        </section>
      )}

      {profile.bio && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-ink-muted">Bio</h2>
          <p className="mt-2 whitespace-pre-wrap text-ink-soft">{profile.bio}</p>
        </section>
      )}

      {(profile.external_links?.length ?? 0) > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-ink-muted">Links</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {profile.external_links!.map((l, i) => (
              <li key={i}>
                <a href={l.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-gradient-motion hover:underline">
                  {l.label || l.url} <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FrequentCollaborators userId={profile.id} />
    </div>
  );
}

function FrequentCollaborators({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["frequent-collaborators", userId],
    queryFn: () => getFrequentCollaborators(userId, 8),
    staleTime: 60_000,
  });
  if (!data || data.length === 0) return null;
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-ink-muted">Frequent collaborators</h2>
      <div className="mt-3 flex flex-wrap gap-3">
        {data.map((c: Collaborator) => {
          const display = c.display_name || c.username || "Anon";
          const inner = (
            <div className="flex w-44 items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:shadow-soft">
              <Avatar className="h-10 w-10">
                <AvatarImage src={c.avatar_url ?? undefined} />
                <AvatarFallback>{display[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{display}</div>
                <div className="truncate text-[11px] text-ink-muted">{c.shared_works} together</div>
              </div>
            </div>
          );
          if (c.username) {
            return <Link key={c.id} to="/u/$username" params={{ username: c.username }}>{inner}</Link>;
          }
          return (
            <ProfilePeek key={c.id} userId={c.id}>
              <button type="button" className="cursor-pointer">{inner}</button>
            </ProfilePeek>
          );
        })}
      </div>
    </section>
  );
}
