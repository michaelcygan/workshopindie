import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MapPin, ExternalLink, Pencil, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WorkCard, type WorkCardData } from "@/components/work-card";
import { CategoryChip } from "@/components/category-chip";
import { FollowButton } from "@/components/follow-button";
import type { Category } from "@/lib/categories";

export const Route = createFileRoute("/u/$username")({ component: ProfilePage });

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
  follower_count: number;
  following_count: number;
  work_count: number;
  worked_with_count: number;
  creator_status: string;
  pinned_work_ids: string[];
  city: { name: string; country: string } | null;
};

async function fetchProfile(username: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,cover_url,bio,headline,categories,external_links,follower_count,following_count,work_count,worked_with_count,creator_status,pinned_work_ids,city:cities(name,country)")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Profile) ?? null;
}

async function fetchUserWorks(userId: string) {
  const { data, error } = await supabase
    .from("work_credits")
    .select("work:works!inner(id,title,slug,category,cover_url,source_type,like_count,save_count,view_count,published_at,created_at,status,visibility, work_credits(role_label,sort_order, profiles(display_name,username)))")
    .eq("user_id", userId)
    .eq("hidden_from_profile", false);
  if (error) throw error;
  type WorkRow = {
    id: string; title: string; slug: string; category: Category;
    cover_url: string | null; source_type: string;
    like_count: number; save_count: number; view_count: number;
    published_at: string | null; created_at: string; status: string; visibility: string;
    work_credits?: { sort_order: number; profiles: { display_name: string | null; username: string | null } | null }[];
  };
  const works = (data as unknown as { work: WorkRow }[])
    .map((r) => r.work)
    .filter((w) => w && w.status === "published" && (w.visibility === "public" || w.visibility === "unlisted"));
  // dedupe
  const seen = new Set<string>();
  const unique = works.filter((w) => (seen.has(w.id) ? false : (seen.add(w.id), true)));
  unique.sort((a, b) => (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at));
  return unique.map<WorkCardData>((r) => ({
    id: r.id, title: r.title, slug: r.slug, category: r.category, cover_url: r.cover_url,
    source_type: r.source_type, like_count: r.like_count, save_count: r.save_count, view_count: r.view_count,
    credits: (r.work_credits ?? []).sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({ display_name: c.profiles?.display_name ?? null, username: c.profiles?.username ?? null })),
  }));
}

function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile, isLoading } = useQuery({ queryKey: ["profile", username], queryFn: () => fetchProfile(username) });
  const { data: works } = useQuery({
    queryKey: ["profile-works", profile?.id],
    queryFn: () => fetchUserWorks(profile!.id),
    enabled: !!profile?.id,
  });

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
  const pinned = (profile.pinned_work_ids ?? []).map((id) => works?.find((w) => w.id === id)).filter(Boolean) as WorkCardData[];
  const rest = works?.filter((w) => !profile.pinned_work_ids?.includes(w.id)) ?? [];

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
              {profile.creator_status === "founding" && (
                <span className="rounded-full bg-violet/10 px-2 py-0.5 text-[11px] font-medium text-violet">Founding</span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              {profile.username && <span>@{profile.username}</span>}
              {profile.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{profile.city.name}</span>}
            </div>
            {profile.headline && <p className="mt-2 text-ink-soft">{profile.headline}</p>}
          </div>

          <div className="flex items-center gap-2">
            {isOwn ? (
              <Button variant="outline" className="rounded-full gap-1.5" onClick={() => navigate({ to: "/me/edit" })}>
                <Pencil className="h-4 w-4" /> Edit profile
              </Button>
            ) : (
              <FollowButton targetUserId={profile.id} />
            )}
            {isOwn && (
              <Button className="rounded-full gap-1.5" onClick={() => navigate({ to: "/works/new" })}>
                <Plus className="h-4 w-4" /> Publish a Work
              </Button>
            )}
          </div>
        </div>

        {/* Categories */}
        {profile.categories?.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {profile.categories.map((c) => <CategoryChip key={c} category={c} />)}
          </div>
        )}

        {/* Bio + links */}
        {(profile.bio || (profile.external_links?.length ?? 0) > 0) && (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {profile.bio && (
              <div className="md:col-span-2 rounded-2xl border border-border bg-surface p-5">
                <p className="whitespace-pre-wrap text-ink-soft">{profile.bio}</p>
              </div>
            )}
            {(profile.external_links?.length ?? 0) > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-5">
                <h3 className="text-xs uppercase tracking-wider text-ink-muted">Links</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {profile.external_links!.map((l, i) => (
                    <li key={i}>
                      <a href={l.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                        {l.label || l.url} <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border border-border bg-surface px-5 py-4 text-sm">
          <Stat label="Works" value={profile.work_count} />
          <Stat label="Worked with" value={profile.worked_with_count} />
          <Stat label="Followers" value={profile.follower_count} />
          <Stat label="Following" value={profile.following_count} />
        </div>

        {/* Pinned */}
        {pinned.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-2xl text-ink">Pinned</h2>
            <motion.div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {pinned.map((w) => <WorkCard key={w.id} work={w} />)}
            </motion.div>
          </section>
        )}

        {/* All works */}
        <section className="mt-12 pb-20">
          <h2 className="font-display text-2xl text-ink">Works</h2>
          {!works ? (
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface-2" />)}
            </div>
          ) : rest.length === 0 && pinned.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
              <p className="text-ink-muted">{isOwn ? "Your portfolio is empty. Publish your first Work." : `${name} hasn't shipped a Work yet.`}</p>
              {isOwn && (
                <Link to="/works/new" className="mt-4 inline-block">
                  <Button className="rounded-full">Publish a Work</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((w) => <WorkCard key={w.id} work={w} />)}
            </div>
          )}
        </section>
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
