import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, ExternalLink, Pencil, Plus, Users, Calendar, Layers, ImagePlus, Sparkles, X } from "lucide-react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WorkCard, type WorkCardData } from "@/components/work-card";
import { CategoryChip } from "@/components/category-chip";
import { FollowButton } from "@/components/follow-button";
import { MessageButton } from "@/components/message-button";
import { ReportDialog } from "@/components/report-dialog";
import { ShareSheet } from "@/components/share-sheet";
import { ProfileCompletionChip } from "@/components/profile-completion-chip";
import { BlockButton } from "@/components/block-button";
import { CreatorBadge } from "@/components/creator-badge";
import { ProfilePeek } from "@/components/profile-peek";
import { PublishFromCollabSheet } from "@/components/publish-from-collab-sheet";
import { dismissPublishNudge } from "@/lib/collab-publish.functions";
import { getFrequentCollaborators, type Collaborator } from "@/lib/network.functions";
import { useDocumentMeta, useJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { CATEGORIES, type Category } from "@/lib/categories";
import { extraMediumLabel } from "@/lib/mediums";

const TAB_VALUES = ["works", "collabs", "activity", "about"] as const;
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
  errorComponent: ({ error, reset }) => (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">Couldn't load this profile</h1>
      <p className="mt-2 text-sm text-ink-muted">{error.message}</p>
      <button onClick={reset} className="mt-6 rounded-full border border-border px-4 py-2 text-sm hover:bg-surface">Try again</button>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">No one here by that name</h1>
      <p className="mt-2 text-ink-muted">This profile doesn't exist or was removed.</p>
      <Link to="/gallery" className="mt-6 inline-block rounded-full border border-border px-4 py-2 text-sm hover:bg-surface">Browse Gallery</Link>
    </main>
  ),
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
    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      url,
      mainEntity: {
        "@type": "Person",
        name,
        alternateName: p?.username ?? undefined,
        description: p?.headline ?? p?.bio ?? undefined,
        image: p?.avatar_url ?? undefined,
        url,
      },
    };
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
    };
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
  mediums: string[] | null;
  tools: string[] | null;
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
    .select("id,username,display_name,avatar_url,cover_url,bio,headline,categories,mediums,tools,external_links,instagram_handle,follower_count,following_count,work_count,worked_with_count,creator_status,pinned_work_ids,aliases,city:cities!profiles_city_id_fkey(name,country,slug),home_city:cities!profiles_home_city_id_fkey(name,country,slug)")
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
    .select("id,title,slug,category,categories,cover_url,embed_url,source_type,like_count,save_count,view_count,published_at,created_at, work_credits(role_label,sort_order,display_name, profiles(id,display_name,username))")
    .eq("created_by", userId)
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  type Row = {
    id: string; title: string; slug: string; category: Category;
    cover_url: string | null; embed_url: string | null; source_type: string;
    like_count: number; save_count: number; view_count: number;
    work_credits?: { sort_order: number; display_name: string | null; profiles: { id: string; display_name: string | null; username: string | null } | null }[];
  };
  return ((data ?? []) as Row[]).map<OwnedWork>((r) => ({
    id: r.id, title: r.title, slug: r.slug, category: r.category,
    cover_url: r.cover_url, embed_url: r.embed_url, source_type: r.source_type,
    like_count: r.like_count, save_count: r.save_count, view_count: r.view_count,
    credits: (r.work_credits ?? []).sort((a, b) => a.sort_order - b.sort_order).map((c) => ({
      id: c.profiles?.id ?? null,
      display_name: c.profiles?.display_name ?? c.display_name ?? null,
      username: c.profiles?.username ?? null,
    })),
  }));
}

async function fetchCreditedWorks(userId: string): Promise<CreditWork[]> {
  const { data, error } = await supabase
    .from("work_credits")
    .select("role_label, work:works!inner(id,title,slug,category,categories,cover_url,embed_url,source_type,like_count,save_count,view_count,published_at,created_at,status,visibility,created_by, owner:profiles!works_created_by_fkey(id,display_name,username), work_credits(role_label,sort_order,display_name, profiles(id,display_name,username)))")
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
      work_credits?: { sort_order: number; display_name: string | null; profiles: { id: string; display_name: string | null; username: string | null } | null }[];
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
        display_name: c.profiles?.display_name ?? c.display_name ?? null,
        username: c.profiles?.username ?? null,
      })),
    });
  }
  return [...seen.values()];
}

async function fetchPinnedWorks(userId: string): Promise<WorkCardData[]> {
  const { data, error } = await supabase
    .from("work_credits")
    .select("pinned_at, work:works!inner(id,title,slug,category,categories,cover_url,embed_url,source_type,like_count,save_count,view_count,published_at,status,visibility, work_credits(role_label,sort_order,display_name, profiles(id,display_name,username,avatar_url)))")
    .eq("user_id", userId)
    .not("pinned_at", "is", null)
    .order("pinned_at", { ascending: false })
    .limit(6);
  if (error) throw error;
  type Row = {
    pinned_at: string;
    work: {
      id: string; title: string; slug: string; category: Category;
      cover_url: string | null; embed_url: string | null; source_type: string;
      like_count: number; save_count: number; view_count: number;
      published_at: string | null; status: string; visibility: string;
      work_credits?: { sort_order: number; display_name: string | null; profiles: { id: string; display_name: string | null; username: string | null; avatar_url: string | null } | null }[];
    };
  };
  return ((data as unknown as Row[]) ?? [])
    .filter((r) => r.work && r.work.status === "published" && (r.work.visibility === "public" || r.work.visibility === "unlisted"))
    .map<WorkCardData>((r) => ({
      id: r.work.id, title: r.work.title, slug: r.work.slug, category: r.work.category,
      cover_url: r.work.cover_url, embed_url: r.work.embed_url, source_type: r.work.source_type,
      like_count: r.work.like_count, save_count: r.work.save_count, view_count: r.work.view_count,
      published_at: r.work.published_at,
      credits: (r.work.work_credits ?? []).sort((a, b) => a.sort_order - b.sort_order).map((c) => ({
        id: c.profiles?.id ?? null,
        display_name: c.profiles?.display_name ?? c.display_name ?? null,
        username: c.profiles?.username ?? null,
        avatar_url: c.profiles?.avatar_url ?? null,
      })),
    }));
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
  const { data: pinnedWorks } = useQuery({
    queryKey: ["profile-pinned", profile?.id],
    queryFn: () => fetchPinnedWorks(profile!.id),
    enabled: !!profile?.id,
  });
  const { data: workshops } = useQuery({
    queryKey: ["profile-workshops", profile?.id],
    queryFn: () => fetchWorkshops(profile!.id),
    enabled: !!profile?.id,
  });


  // Owner-only data (drafts, applied + participating workshops, closed-collab nudges)
  const isOwnEarly = !!user && !!profile && user.id === profile.id;

  const { data: drafts } = useQuery({
    queryKey: ["profile-drafts", profile?.id],
    enabled: isOwnEarly,
    queryFn: async () => {
      const { data } = await supabase.from("works")
        .select("id,title,slug,category,categories,cover_url,status,updated_at")
        .eq("created_by", profile!.id)
        .neq("status", "published")
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: applied } = useQuery({
    queryKey: ["profile-applied", profile?.id],
    enabled: isOwnEarly,
    queryFn: async () => {
      const { data } = await supabase.from("workshop_applications")
        .select("id,status,submitted_at,role:workshop_roles(role_name), workshop:workshops!inner(id,title,slug,category,starts_at)")
        .eq("user_id", profile!.id)
        .order("submitted_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: participating } = useQuery({
    queryKey: ["profile-participating", profile?.id],
    enabled: isOwnEarly,
    queryFn: async () => {
      const { data } = await supabase.from("workshop_participants")
        .select("id,participant_status,joined_at,workshop:workshops!inner(id,title,slug,category,status,starts_at,check_in_opens_at,check_in_closes_at)")
        .eq("user_id", profile!.id)
        .order("joined_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: closedNudges = [] } = useQuery({
    queryKey: ["profile-closed-collabs", profile?.id],
    enabled: isOwnEarly,
    queryFn: async () => {
      const { data } = await supabase.from("collab_posts")
        .select("id,title,slug,description")
        .eq("user_id", profile!.id)
        .eq("status", "closed")
        .is("resulting_work_id", null)
        .is("close_nudge_dismissed_at", null)
        .order("closed_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
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

  const activityCount = (drafts?.length ?? 0) + (workshops?.length ?? 0) + (applied?.length ?? 0) + (participating?.length ?? 0);
  // Works tab is unified: owned + credited (visitor-visible).
  const worksTotal = (ownedWorks?.length ?? 0) + (creditedWorks?.length ?? 0);
  const counts: Record<ProfileTab, number> = {
    works: worksTotal,
    collabs: openCollabs?.length ?? 0,
    activity: activityCount,
    about: 1,
  };

  // Default tab: always Works for a portfolio surface.
  const defaultTab: ProfileTab = search.tab ?? "works";

  const setTab = (t: ProfileTab) => navigate({ to: "/u/$username", params: { username }, search: { tab: t }, replace: true });

  const visibleTabs: ProfileTab[] = TAB_VALUES.filter((t) => {
    if (t === "activity") return isOwn; // owner-only
    if (t === "collabs") return isOwn || counts.collabs > 0;
    return true; // works, about always
  });


  return (
    <main>
      {/* Cover */}
      <div className="group relative h-56 overflow-hidden bg-surface-2 md:h-80">
        {profile.cover_url ? (
          <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full gradient-warm opacity-70" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background/60" />
        {isOwn && !profile.cover_url && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              variant="outline"
              className="rounded-full gap-1.5 bg-background/80 backdrop-blur"
              onClick={() => navigate({ to: "/me/edit" })}
            >
              <ImagePlus className="h-4 w-4" /> Add cover photo
            </Button>
          </div>
        )}
        {isOwn && profile.cover_url && (
          <button
            type="button"
            onClick={() => navigate({ to: "/me/edit" })}
            className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs text-ink shadow-soft backdrop-blur opacity-0 transition group-hover:opacity-100"
          >
            <ImagePlus className="h-3.5 w-3.5" /> Change cover
          </button>
        )}
      </div>

      <div className="mx-auto max-w-5xl px-4 md:px-6">
        {/* Avatar + action buttons row — only the avatar overlaps the cover */}
        <div className="-mt-12 flex items-end justify-between gap-4 md:-mt-16">
          <Avatar className="h-24 w-24 ring-4 ring-background md:h-32 md:w-32">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-2xl">{name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex flex-wrap items-center justify-end gap-2 pb-2">
            {isOwn ? (
              <>
                <ShareSheet
                  entity={{
                    type: "profile",
                    id: profile.id,
                    url: `https://workshopindie.com/u/${profile.username}`,
                    title: name,
                    subtitle: profile.headline ?? undefined,
                  }}
                />
                <Button variant="outline" className="rounded-full gap-1.5" onClick={() => navigate({ to: "/me/edit" })}>
                  <Pencil className="h-4 w-4" /> Edit profile
                </Button>
              </>
            ) : (
              <>
                <FollowButton targetUserId={profile.id} />
                <MessageButton otherUserId={profile.id} />
                <ShareSheet
                  entity={{
                    type: "profile",
                    id: profile.id,
                    url: `https://workshopindie.com/u/${profile.username}`,
                    title: name,
                    subtitle: profile.headline ?? undefined,
                  }}
                />
                <ReportDialog entityType="profile" entityId={profile.id} />
                <BlockButton targetUserId={profile.id} />
              </>
            )}
          </div>
        </div>

        {/* Identity block — sits below the cover, never clipped */}
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl text-ink md:text-4xl">{name}</h1>
            <CreatorBadge status={profile.creator_status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
            {profile.username && <span>@{profile.username}</span>}
            {profile.home_city && (!profile.city || profile.city.slug === profile.home_city.slug) && (
              <Link to="/cities/$slug" params={{ slug: profile.home_city.slug }} className="inline-flex items-center gap-1 hover:text-ink">
                <MapPin className="h-3.5 w-3.5" />{profile.home_city.name}
              </Link>
            )}
            {profile.home_city && profile.city && profile.city.slug !== profile.home_city.slug && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                Based in <Link to="/cities/$slug" params={{ slug: profile.home_city.slug }} className="hover:text-ink underline-offset-2 hover:underline">{profile.home_city.name}</Link>
                , currently in <Link to="/cities/$slug" params={{ slug: profile.city.slug }} className="hover:text-ink underline-offset-2 hover:underline">{profile.city.name}</Link>
              </span>
            )}
            {!profile.home_city && profile.city && (
              <Link to="/cities/$slug" params={{ slug: profile.city.slug }} className="inline-flex items-center gap-1 hover:text-ink">
                <MapPin className="h-3.5 w-3.5" />{profile.city.name}
              </Link>
            )}
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
                <span key={i} className="rounded-full border border-border bg-surface px-2 py-0.5 text-ink-soft">{a}</span>
              ))}
            </div>
          )}
          {(profile.tools?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {(profile.tools ?? []).slice(0, 6).map((t, i) => (
                <span key={`${t}-${i}`} className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-ink-soft">{t}</span>
              ))}
              {(profile.tools?.length ?? 0) > 6 && (
                <button type="button" onClick={() => setTab("about")} className="text-[11px] text-ink-muted hover:text-ink">
                  +{(profile.tools?.length ?? 0) - 6} more
                </button>
              )}
            </div>
          )}
        </div>

        {/* Owner-only primary CTAs */}
        {isOwn && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/works/new"><Button className="rounded-full gap-1.5"><Plus className="h-4 w-4" /> Publish a Work</Button></Link>
            <Link to="/collab/new"><Button variant="outline" className="rounded-full gap-1.5"><Plus className="h-4 w-4" /> Post a Collab</Button></Link>
            <Link to="/lounge"><Button variant="ghost" className="rounded-full gap-1.5"><Sparkles className="h-4 w-4" /> Drop into a Lounge</Button></Link>
          </div>
        )}

        {/* Owner-only: profile completion chip */}
        {isOwn && (
          <ProfileCompletionChip
            className="mt-4"
            hasAvatar={!!profile.avatar_url}
            hasHomeCity={!!profile.home_city}
            hasBio={!!(profile.bio && profile.bio.trim().length > 0)}
            hasWork={(ownedWorks?.length ?? 0) > 0}
          />
        )}

        {/* Wrap-up nudges now live in /me/collabs to keep the public profile clean. */}
        {isOwn && closedNudges.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{closedNudges.length} collab{closedNudges.length === 1 ? "" : "s"} to wrap up</p>
              <p className="text-xs text-ink-muted">Publish the Work that came out of them.</p>
            </div>
            <Link to="/me/collabs"><Button size="sm" className="rounded-full">Wrap up</Button></Link>
          </div>
        )}

        {/* Stats strip */}
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border border-border bg-surface px-5 py-4 text-sm">
          <Stat label="Works" value={counts.works} />
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
                {t}{t !== "about" && (
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
              owned={ownedWorks ?? []}
              credited={creditedWorks ?? []}
              pinnedWorks={pinnedWorks ?? []}
              isOwn={isOwn}
              ownerName={name}
              isLoading={!ownedWorks || !creditedWorks}
            />
          )}
          {defaultTab === "collabs" && (
            <CollabsTab items={openCollabs ?? []} isOwn={isOwn} ownerName={name} isLoading={!openCollabs} />
          )}
          {defaultTab === "activity" && isOwn && (
            <ActivityTab
              drafts={(drafts ?? []) as DraftRow[]}
              workshops={workshops ?? []}
              applied={(applied ?? []) as AppliedRow[]}
              participating={(participating ?? []) as ParticipatingRow[]}
              isLoading={!applied || !participating || !drafts || !workshops}
            />
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

/* ---------------- WORKS TAB (unified: created + credited) ---------------- */

type MergedWork = WorkCardData & {
  _role: "created" | "credited";
  my_role?: string;
  owner?: { id: string; display_name: string | null; username: string | null } | null;
};

type SortMode = "recent" | "oldest" | "loved";

function WorksTab({
  owned, credited, pinnedWorks, isOwn, ownerName, isLoading,
}: {
  owned: OwnedWork[];
  credited: CreditWork[];
  pinnedWorks: WorkCardData[];
  isOwn: boolean;
  ownerName: string;
  isLoading: boolean;
}) {
  const [roleFilter, setRoleFilter] = useState<"all" | "created" | "credited">("all");
  const [activeCat, setActiveCat] = useState<Category | "all">("all");
  const [sort, setSort] = useState<SortMode>("recent");

  const merged: MergedWork[] = useMemo(() => {
    const created: MergedWork[] = owned.map((w) => ({ ...w, _role: "created" }));
    const cred: MergedWork[] = credited.map((w) => ({ ...w, _role: "credited", my_role: w.my_role, owner: w.owner }));
    return [...created, ...cred];
  }, [owned, credited]);

  const roleFiltered = useMemo(() => merged.filter((w) => roleFilter === "all" || w._role === roleFilter), [merged, roleFilter]);

  const catCounts = useMemo(() => {
    const m = new Map<Category, number>();
    for (const w of roleFiltered) m.set(w.category, (m.get(w.category) ?? 0) + 1);
    return m;
  }, [roleFiltered]);
  const availableCats = useMemo(() => CATEGORIES.filter((c) => catCounts.get(c.id as Category)), [catCounts]);

  const filtered = useMemo(() => {
    const arr = activeCat === "all" ? roleFiltered : roleFiltered.filter((w) => w.category === activeCat);
    const sorted = [...arr];
    if (sort === "loved") {
      sorted.sort((a, b) => b.like_count - a.like_count);
    } else if (sort === "oldest") {
      sorted.sort((a, b) => (a.published_at ?? "").localeCompare(b.published_at ?? ""));
    }
    // "recent" is the default order from fetchers (published_at desc).
    return sorted;
  }, [roleFiltered, activeCat, sort]);

  if (isLoading) {
    return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface-2" />)}</div>;
  }

  if (merged.length === 0 && pinnedWorks.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-ink-muted">{isOwn ? "Your portfolio is empty. Publish your first Work, or post a Collab to start one with others." : `${ownerName} hasn't shipped a Work yet.`}</p>
        {isOwn && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link to="/works/new"><Button className="rounded-full">Publish a Work</Button></Link>
            <Link to="/collab/new"><Button variant="outline" className="rounded-full">Post a Collab</Button></Link>
          </div>
        )}
      </div>
    );
  }

  const createdCount = merged.filter((w) => w._role === "created").length;
  const creditedCount = merged.filter((w) => w._role === "credited").length;

  return (
    <>
      {pinnedWorks.length > 0 && activeCat === "all" && roleFilter === "all" && (
        <section className="mb-10">
          <h2 className="font-display text-xl text-ink">Pinned</h2>
          <p className="mt-1 text-xs text-ink-muted">A curated portfolio — up to 6 Works {isOwn ? "you've" : `${ownerName} has`} pinned.</p>
          <div className="mt-3 grid grid-cols-1 gap-5 md:grid-cols-2">
            {pinnedWorks.map((w) => (
              <WorkCard
                key={w.id}
                work={w}
                density="hero"
                showAvatars
                showCounters
              />
            ))}
          </div>
        </section>
      )}
      {pinnedWorks.length === 0 && isOwn && merged.length > 0 && (
        <section className="mb-10 rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
          <p className="text-sm text-ink-muted">No pinned Work yet. Open a Work you're credited on and tap <span className="font-medium text-ink">Pin</span> to feature it here.</p>
        </section>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {/* Role chips — only show when there's a mix */}
        {createdCount > 0 && creditedCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <MediumChip active={roleFilter === "all"} onClick={() => setRoleFilter("all")} label="All" count={merged.length} />
            <MediumChip active={roleFilter === "created"} onClick={() => setRoleFilter("created")} label="Created" count={createdCount} />
            <MediumChip active={roleFilter === "credited"} onClick={() => setRoleFilter("credited")} label="Credited" count={creditedCount} />
          </div>
        )}
        {availableCats.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {createdCount > 0 && creditedCount > 0 && <span className="mx-1 self-center text-ink-muted">·</span>}
            <MediumChip active={activeCat === "all"} onClick={() => setActiveCat("all")} label="All mediums" count={roleFiltered.length} />
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
        <div className="ml-auto">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink-soft focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Sort Works"
          >
            <option value="recent">Recent</option>
            <option value="oldest">Oldest</option>
            <option value="loved">Most loved</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-ink-muted">
          {isOwn ? `Nothing here yet.` : "Nothing matches this filter."}{" "}
          <button type="button" onClick={() => { setRoleFilter("all"); setActiveCat("all"); }} className="text-ink underline-offset-2 hover:underline">Reset filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => (
            <WorkCard
              key={`${w._role}-${w.id}`}
              work={w}
              creditBadge={w._role === "credited" ? w.my_role ?? null : null}
            />
          ))}
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

/* ---------------- GROUPS (inline in About) ---------------- */

function GroupsSection({ home, city }: { home: { name: string; country: string; slug: string } | null; city: { name: string; country: string; slug: string } | null }) {
  const groups: { kind: "home" | "current"; name: string; country: string; slug: string }[] = [];
  if (home) groups.push({ kind: "home", ...home });
  if (city && city.slug !== home?.slug) groups.push({ kind: "current", ...city });
  if (groups.length === 0) return null;
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-ink-muted">City groups</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
    </section>
  );
}

/* ---------------- ABOUT TAB ---------------- */

function AboutTab({ profile }: { profile: Profile }) {
  const based = profile.home_city ?? profile.city;
  return (
    <div className="space-y-8">
      {based && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-ink-muted">Based in</h2>
          <Link to="/cities/$slug" params={{ slug: based.slug }} className="mt-2 inline-flex items-center gap-1.5 text-ink-soft hover:text-ink">
            <MapPin className="h-4 w-4" />{based.name}{based.country ? `, ${based.country}` : ""}
          </Link>
          {profile.home_city && profile.city && profile.city.slug !== profile.home_city.slug && (
            <p className="mt-1 text-xs text-ink-muted">
              Currently in <Link to="/cities/$slug" params={{ slug: profile.city.slug }} className="underline-offset-2 hover:underline">{profile.city.name}</Link>
            </p>
          )}
        </section>
      )}
      {(profile.categories?.length > 0 || (profile.mediums?.length ?? 0) > 0) && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-ink-muted">Mediums</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.categories.map((c) => <CategoryChip key={c} category={c} />)}
            {(profile.mediums ?? []).map((m) => (
              <span key={m} className="inline-flex items-center rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-ink-soft">
                {extraMediumLabel(m)}
              </span>
            ))}
          </div>
        </section>
      )}

      {(profile.tools?.length ?? 0) > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-ink-muted">Tools</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(profile.tools ?? []).map((t, i) => (
              <span key={`${t}-${i}`} className="inline-flex items-center rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-ink">
                {t}
              </span>
            ))}
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

      <GroupsSection home={profile.home_city} city={profile.city} />

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

/* ---------------- OWNER-ONLY: ACTIVITY TAB (drafts + workshops + applied + participating) ---------------- */

type DraftRow = { id: string; title: string; slug: string; category: Category; cover_url: string | null; status: string; updated_at: string };

type AppliedRow = {
  id: string;
  status: string;
  submitted_at: string;
  role: { role_name: string } | null;
  workshop: { id: string; title: string; slug: string; category: Category; starts_at: string | null };
};

type ParticipatingRow = {
  id: string;
  participant_status: string;
  joined_at: string;
  workshop: {
    id: string;
    title: string;
    slug: string;
    category: Category;
    status: string;
    starts_at: string | null;
    check_in_opens_at: string | null;
    check_in_closes_at: string | null;
  };
};

function whenText(starts: string | null) {
  if (!starts) return "Time TBD";
  const d = new Date(starts);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
    + " · " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ActivityTab({
  drafts, workshops, applied, participating, isLoading,
}: {
  drafts: DraftRow[];
  workshops: WorkshopRow[];
  applied: AppliedRow[];
  participating: ParticipatingRow[];
  isLoading: boolean;
}) {
  if (isLoading) return <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />;
  const empty = drafts.length === 0 && workshops.length === 0 && applied.length === 0 && participating.length === 0;
  if (empty) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-ink-muted">Nothing in flight. Start a draft, drop into a Lounge, or apply to a Collab.</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Link to="/works/new"><Button className="rounded-full">Start a Work</Button></Link>
          <Link to="/lounge"><Button variant="outline" className="rounded-full">Drop into a Lounge</Button></Link>
          <Link to="/collab"><Button variant="ghost" className="rounded-full">Browse Collabs</Button></Link>
        </div>
      </div>
    );
  }
  const now = Date.now();
  return (
    <div className="space-y-8">
      {drafts.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-ink-muted">Drafts <span className="ml-1 text-ink-muted/60">{drafts.length}</span></h2>
          <p className="mt-1 text-xs text-ink-muted">Unfinished Works — only you can see these.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {drafts.map((w) => (
              <Link key={w.id} to="/works/$slug" params={{ slug: w.slug }} className="flex gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:shadow-soft">
                {w.cover_url ? (
                  <img src={w.cover_url} className="h-16 w-16 rounded-xl object-cover" alt="" />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-surface-2" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <CategoryChip category={w.category} />
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-ink-soft">{w.status.replace("_", " ")}</span>
                  </div>
                  <h3 className="mt-1 truncate font-medium text-ink">{w.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {workshops.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-ink-muted">Lounges <span className="ml-1 text-ink-muted/60">{workshops.length}</span></h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {workshops.map((w) => (
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
        </section>
      )}

      {participating.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-ink-muted">Participating <span className="ml-1 text-ink-muted/60">{participating.length}</span></h2>
          <div className="mt-3 space-y-2">
            {participating.map((p) => {
              const w = p.workshop;
              const ciOpen = w.check_in_opens_at && w.check_in_closes_at
                && now >= new Date(w.check_in_opens_at).getTime()
                && now <= new Date(w.check_in_closes_at).getTime();
              return (
                <Link key={p.id} to="/workshops/$slug" params={{ slug: w.slug }} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:shadow-soft">
                  <CategoryChip category={w.category} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium text-ink">{w.title}</h3>
                    <p className="text-xs text-ink-muted">{whenText(w.starts_at)}</p>
                  </div>
                  {ciOpen && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Check in now</span>}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-ink-soft">{p.participant_status.replace("_", " ")}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {applied.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-ink-muted">Applied <span className="ml-1 text-ink-muted/60">{applied.length}</span></h2>
          <div className="mt-3 space-y-2">
            {applied.map((a) => (
              <Link key={a.id} to="/workshops/$slug" params={{ slug: a.workshop.slug }} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:shadow-soft">
                <CategoryChip category={a.workshop.category} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium text-ink">{a.workshop.title}</h3>
                  <p className="text-xs text-ink-muted">{a.role?.role_name ? `for ${a.role.role_name} · ` : ""}{whenText(a.workshop.starts_at)}</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-ink-soft">{a.status.replace("_", " ")}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


