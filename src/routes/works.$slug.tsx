import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Eye, ArrowLeft, ExternalLink, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CategoryChip } from "@/components/category-chip";
import { WorkActions } from "@/components/work-actions";
import { EnterWorkshopButton } from "@/components/enter-workshop-button";
import { CommentThread } from "@/components/comment-thread";
import { ReportDialog } from "@/components/report-dialog";
import { ShareSheet } from "@/components/share-sheet";
import { CreditStrip, type CreditChip } from "@/components/credit-strip";
import { ProfilePeek } from "@/components/profile-peek";
import { WorkCard } from "@/components/work-card";
import { EmbedPlayer, providerFromUrl } from "@/components/embed-player";
import { getCoCreditedWorks } from "@/lib/network.functions";
import { useDocumentMeta, useJsonLd } from "@/lib/seo";
import { SOURCE_LABELS, type Category } from "@/lib/categories";
import { format } from "date-fns";

export const Route = createFileRoute("/works/$slug")({
  component: WorkDetail,
  loader: async ({ params }) => {
    const { getWorkSeo } = await import("@/lib/seo-loaders.functions");
    const data = await getWorkSeo({ data: { slug: params.slug } });
    return { seo: data };
  },
  head: ({ params, loaderData }) => {
    const w = loaderData?.seo;
    const url = `https://workshopindie.com/works/${params.slug}`;
    const title = w?.title ? `${w.title} — Workshop` : "Work — Workshop";
    const description = w?.excerpt ?? w?.description?.slice(0, 160) ?? "A creative work on Workshop.";
    const meta = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: w?.cover_url ? "summary_large_image" : "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (w?.cover_url) {
      meta.push({ property: "og:image", content: w.cover_url });
      meta.push({ name: "twitter:image", content: w.cover_url });
    }
    return { meta, links: [{ rel: "canonical", href: url }] };
  },
});

type WorkRow = {
  id: string; title: string; slug: string; category: Category;
  description: string | null; excerpt: string | null;
  cover_url: string | null; primary_url: string | null; embed_url: string | null;
  source_type: string; license_type: string; published_at: string | null; created_at: string;
  source_workshop_id: string | null;
  like_count: number; save_count: number; view_count: number; comment_count: number;
  created_by: string;
  work_credits: { id: string; role_label: string; sort_order: number;
    profiles: { id: string; display_name: string | null; username: string | null; avatar_url: string | null; headline: string | null } | null;
  }[];
};

async function fetchWork(slug: string) {
  const { data, error } = await supabase
    .from("works")
    .select("id,title,slug,category,description,excerpt,cover_url,primary_url,embed_url,source_type,license_type,published_at,created_at,like_count,save_count,view_count,comment_count,created_by,source_workshop_id, work_credits(id,role_label,sort_order, profiles(id,display_name,username,avatar_url,headline))")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as WorkRow) ?? null;
}

function WorkDetail() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { data: work, isLoading } = useQuery({ queryKey: ["work", slug], queryFn: () => fetchWork(slug) });

  // Bump view counter once per mount.
  useEffect(() => {
    if (!work) return;
    supabase.from("works").update({ view_count: work.view_count + 1 }).eq("id", work.id).then(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work?.id]);

  const credits = useMemo(() => (work?.work_credits ?? []).slice().sort((a, b) => a.sort_order - b.sort_order), [work]);

  useDocumentMeta({
    title: work?.title,
    description: work?.excerpt ?? work?.description?.slice(0, 160) ?? undefined,
    image: work?.cover_url,
    type: "article",
  });
  useJsonLd(work ? {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: work.title,
    description: work.excerpt ?? work.description ?? undefined,
    image: work.cover_url ?? undefined,
    url: work.primary_url ?? undefined,
    datePublished: work.published_at ?? work.created_at,
    license: work.license_type,
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: work.like_count },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/ViewAction", userInteractionCount: work.view_count },
    ],
    creator: credits.map((c) => ({ "@type": "Person", name: c.profiles?.display_name ?? c.profiles?.username ?? "Anon" })),
  } : null);

  if (isLoading) {
    return <main className="mx-auto max-w-4xl px-4 py-10"><div className="aspect-video animate-pulse rounded-3xl bg-surface-2" /></main>;
  }
  if (!work) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-4xl text-ink">Work not found</h1>
        <Link to="/" className="mt-6 inline-block"><Button variant="outline" className="rounded-full">Back to gallery</Button></Link>
      </main>
    );
  }

  return (
    <main>
      <div className="mx-auto max-w-4xl px-4 pt-6 md:px-6">
        <button onClick={() => navigate({ to: "/" })} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      <article className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-10">
        <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center gap-2">
            <CategoryChip category={work.category} />
            <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] text-ink-soft">
              {SOURCE_LABELS[work.source_type] ?? work.source_type}
            </span>
            <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-ink-muted">
              {work.license_type.replace("_", " ")}
            </span>
          </div>
          <h1 className="font-display text-4xl leading-[1.05] text-ink md:text-6xl">{work.title}</h1>
          {work.excerpt && <p className="text-lg text-ink-soft">{work.excerpt}</p>}

          {/* Byline — the cast, right under the title */}
          {credits.length > 0 && (
            <Byline credits={credits} />
          )}
        </motion.header>

        {/* Embedded player (YouTube, Vimeo, SoundCloud, Spotify, Bandcamp…) or cover */}
        {work.embed_url ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-8">
            <EmbedPlayer url={work.embed_url} provider={providerFromUrl(work.embed_url)} title={work.title} poster={work.cover_url} />
          </motion.div>
        ) : work.cover_url && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="mt-8 overflow-hidden rounded-3xl border border-border bg-surface-2">
            <img src={work.cover_url} alt={work.title} className="w-full object-cover" />
          </motion.div>
        )}

        {/* Meta strip */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
          <div className="flex items-center gap-3 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-1.5"><Eye className="h-4 w-4" /> {work.view_count} views</span>
            {work.published_at && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> {format(new Date(work.published_at), "MMM d, yyyy")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <WorkActions workId={work.id} initialLikes={work.like_count} initialSaves={work.save_count} />
            <ShareSheet
              entity={{
                type: "work",
                id: work.id,
                url: `https://workshopindie.com/works/${work.slug}`,
                title: work.title,
                subtitle: work.excerpt ?? undefined,
              }}
            />
            <ReportDialog entityType="work" entityId={work.id} />
          </div>
        </div>

        {/* Body */}
        {work.description && (
          <div className="prose-workshop mt-8 whitespace-pre-wrap text-base leading-relaxed text-ink-soft">{work.description}</div>
        )}

        {work.primary_url && (
          <a href={work.primary_url} target="_blank" rel="noreferrer noopener"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm text-background hover:opacity-90">
            View original <ExternalLink className="h-4 w-4" />
          </a>
        )}

        {/* Credits — cast strip */}
        {credits.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-2xl text-ink">Credits</h2>
            <CreditStrip
              className="mt-4"
              credits={credits.map<CreditChip>((c) => ({
                id: c.id,
                role_label: c.role_label,
                profiles: c.profiles
                  ? {
                      id: c.profiles.id,
                      display_name: c.profiles.display_name,
                      username: c.profiles.username,
                      avatar_url: c.profiles.avatar_url,
                    }
                  : null,
              }))}
            />
          </section>
        )}

        {/* Also worked together — the first visible network payoff */}
        <AlsoWorkedTogether workId={work.id} createdBy={work.created_by} />

        {/* Members-only: re-enter the studio while the Workshop is still alive */}
        {work.source_workshop_id && (
          <div className="mt-10 flex items-center justify-end">
            <EnterWorkshopButton workshopId={work.source_workshop_id} />
          </div>
        )}

        {/* Comments */}
        <section className="mt-14">
          <CommentThread workId={work.id} />
        </section>
      </article>
    </main>
  );
}

function Byline({ credits }: { credits: WorkRow["work_credits"] }) {
  const shown = credits.slice(0, 3);
  const extra = credits.length - shown.length;
  return (
    <p className="text-sm text-ink-muted">
      by{" "}
      {shown.map((c, i) => {
        const p = c.profiles;
        const name = p?.display_name || p?.username || "Anon";
        const sep = i < shown.length - 1 ? ", " : extra > 0 ? `, +${extra} more` : "";
        const inner = (
          <span className="font-medium text-ink hover:text-gradient-motion hover:underline underline-offset-2 transition">
            {name}
          </span>
        );
        if (p?.username) {
          return (
            <span key={c.id}>
              <Link to="/u/$username" params={{ username: p.username }}>{inner}</Link>
              {sep}
            </span>
          );
        }
        if (p?.id) {
          return (
            <span key={c.id}>
              <ProfilePeek userId={p.id}>
                <button type="button" className="cursor-pointer">{inner}</button>
              </ProfilePeek>
              {sep}
            </span>
          );
        }
        return <span key={c.id}>{inner}{sep}</span>;
      })}
    </p>
  );
}

function AlsoWorkedTogether({ workId, createdBy }: { workId: string; createdBy: string }) {
  const { data } = useQuery({
    queryKey: ["co-credited-works", workId],
    queryFn: () => getCoCreditedWorks(workId, createdBy),
    staleTime: 60_000,
  });
  if (!data || data.length === 0) return null;
  return (
    <section className="mt-14">
      <h2 className="font-display text-2xl text-ink">Also made together</h2>
      <p className="mt-1 text-sm text-ink-muted">Other Works these collaborators have shipped as a group.</p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.slice(0, 3).map((w) => <WorkCard key={w.id} work={w} />)}
      </div>
    </section>
  );
}
