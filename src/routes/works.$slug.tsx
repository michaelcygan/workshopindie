import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Eye, ArrowLeft, ExternalLink, Calendar, Pin, PinOff, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { CategoryChips } from "@/components/category-chips";
import { WorkActions } from "@/components/work-actions";
import { EnterWorkshopButton } from "@/components/enter-workshop-button";
import { CommentThread } from "@/components/comment-thread";
import { ReportDialog } from "@/components/report-dialog";
import { ShareSheet } from "@/components/share-sheet";
import { type CreditChip } from "@/components/credit-strip";
import { WorkCreditLayer } from "@/components/work-credit-layer";
import { ProfilePeek } from "@/components/profile-peek";
import { WorkCard } from "@/components/work-card";
import { EmbedPlayer, providerFromUrl } from "@/components/embed-player";
// WorkSocialProof (vouches + boosts) retired in v1 distillation pass.
import { WorkPublishedNudge } from "@/components/nudges/work-published-nudge";
import { getCoCreditedWorks } from "@/lib/network.functions";
import { getMyPinForWork, togglePinCredit } from "@/lib/works.functions";
import { useDocumentMeta, useJsonLd } from "@/lib/seo";
import { SOURCE_LABELS, type Category } from "@/lib/categories";

const LICENSE_LABELS: Record<string, string> = {
  cc_by: "CC BY",
  rights_managed_externally: "Rights managed",
  portfolio_credit_only: "Credit only",
  private: "Private",
};
import { toast } from "sonner";
import { format } from "date-fns";


export const Route = createFileRoute("/works/$slug")({
  component: WorkDetail,
  errorComponent: ({ error, reset }) => (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">Couldn't load this piece</h1>
      <p className="mt-2 text-sm text-ink-muted">{error.message}</p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset} className="rounded-full">Try again</Button>
        <Link to="/gallery"><Button variant="outline" className="rounded-full">Back to Gallery</Button></Link>
      </div>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-4xl text-ink">Not found</h1>
      <p className="mt-2 text-sm text-ink-muted">It may have been removed or made private.</p>
      <Link to="/gallery" className="mt-6 inline-block">
        <Button variant="outline" className="rounded-full">Back to Gallery</Button>
      </Link>
    </main>
  ),
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
    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: w?.title ?? "Work",
      description: w?.excerpt ?? w?.description ?? undefined,
      image: w?.cover_url ?? undefined,
      url,
    };
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
    };
  },
});


type WorkRow = {
  id: string; title: string; slug: string; category: Category; categories: Category[] | null;
  description: string | null; excerpt: string | null;
  cover_url: string | null; primary_url: string | null; embed_url: string | null;
  source_type: string; license_type: string; published_at: string | null; created_at: string;
  source_workshop_id: string | null;
  like_count: number; save_count: number; view_count: number; comment_count: number;
  vouch_count: number; boost_count: number;
  created_by: string;
  // Book fields (only populated when category === 'writing_book')
  book_author: string | null;
  book_publisher: string | null;
  book_isbn: string | null;
  book_published_on: string | null;
  book_page_count: number | null;
  book_buy_links: { label: string; url: string }[] | null;
  book_excerpt_url: string | null;
  work_credits: { id: string; role_label: string; sort_order: number; display_name: string | null;
    profiles: { id: string; display_name: string | null; username: string | null; avatar_url: string | null; headline: string | null } | null;
  }[];
};

async function fetchWork(slug: string) {
  const { data, error } = await supabase
    .from("works")
    .select("id,title,slug,category,categories,description,excerpt,cover_url,primary_url,embed_url,source_type,license_type,published_at,created_at,like_count,save_count,view_count,comment_count,vouch_count,boost_count,created_by,source_workshop_id,book_author,book_publisher,book_isbn,book_published_on,book_page_count,book_buy_links,book_excerpt_url, work_credits(id,role_label,sort_order,display_name, profiles(id,display_name,username,avatar_url,headline))")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as WorkRow) ?? null;
}

function WorkDetail() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: work, isLoading } = useQuery({ queryKey: ["work", slug], queryFn: () => fetchWork(slug) });

  // Rate-limited view bump — RPC dedupes per (work, browser, hour).
  useEffect(() => {
    if (!work) return;
    let key: string;
    try {
      key = localStorage.getItem("ws_view_key") ?? "";
      if (!key) {
        key = crypto.randomUUID();
        localStorage.setItem("ws_view_key", key);
      }
    } catch {
      key = Math.random().toString(36).slice(2);
    }
    supabase.rpc("bump_work_view", { _work_id: work.id, _key: key }).then(() => {});
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
    creator: credits.map((c) => ({ "@type": "Person", name: c.profiles?.display_name ?? c.profiles?.username ?? c.display_name ?? "Anon" })),
  } : null);

  if (isLoading) {
    return <main className="mx-auto max-w-4xl px-4 py-10"><div className="aspect-video animate-pulse rounded-3xl bg-surface-2" /></main>;
  }
  if (!work) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-4xl text-ink">Not found</h1>
        <Link to="/gallery" className="mt-6 inline-block"><Button variant="outline" className="rounded-full">Back to Gallery</Button></Link>
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
            <CategoryChips primary={work.category} categories={work.categories} />
            <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] text-ink-soft">
              {SOURCE_LABELS[work.source_type] ?? work.source_type}
            </span>
            <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] text-ink-muted">
              {LICENSE_LABELS[work.license_type] ?? work.license_type.replaceAll("_", " ")}
            </span>
          </div>
          <h1 className="font-display text-4xl leading-[1.05] text-ink md:text-6xl">{work.title}</h1>
          {work.category === "writing_book" && work.book_author && (
            <p className="text-lg text-ink-soft">by <span className="text-ink">{work.book_author}</span></p>
          )}
          {work.excerpt && <p className="text-lg text-ink-soft">{work.excerpt}</p>}

          {/* Byline — the cast, right under the title */}
          {credits.length > 0 && (
            <Byline credits={credits} />
          )}

          {/* Date line — the only temporal chrome */}
          <DateLine publishedAt={work.published_at ?? work.created_at} sourceWorkshopId={work.source_workshop_id} isOwner={user?.id === work.created_by} slug={work.slug} />
        </motion.header>


        {/* Book hero — portrait cover + buy buttons */}
        {work.category === "writing_book" ? (
          <BookHero work={work} />
        ) : work.embed_url ? (
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
          </div>
          <div className="flex items-center gap-1">
            {user?.id === work.created_by && (
              <Link to="/works/$slug/edit" params={{ slug: work.slug }}>
                <Button variant="ghost" size="sm" className="rounded-full gap-1.5">
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              </Link>
            )}
            <PinToProfileButton workId={work.id} credits={credits} />
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

        {/* Non-book "View original" CTA — books use the BookHero buy buttons instead */}
        {work.category !== "writing_book" && work.primary_url && (
          <a href={work.primary_url} target="_blank" rel="noreferrer noopener"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm text-background hover:opacity-90">
            View original <ExternalLink className="h-4 w-4" />
          </a>
        )}

        {/* Owner nudge — within 24h of publish, no credits yet */}
        <WorkPublishedNudge
          workId={work.id}
          createdBy={work.created_by}
          publishedAt={work.published_at}
          creditCount={credits.length}
        />

        {/* Credits — cast strip + provenance chips */}
        <div id="credits">
          <WorkCreditLayer
            workId={work.id}
            credits={credits.map<CreditChip>((c) => ({
              id: c.id,
              role_label: c.role_label,
              display_name: c.display_name,
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
        </div>

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
          <CommentThread workId={work.id} ownerId={work.created_by} />
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
        const name = p?.display_name || p?.username || c.display_name || "Anon";
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
        {data.slice(0, 3).map((w) => <WorkCard key={w.id} work={w} showAvatars />)}
      </div>
    </section>
  );
}

function DateLine({ publishedAt, sourceWorkshopId }: { publishedAt: string | null; sourceWorkshopId: string | null }) {
  const { data: workshop } = useQuery({
    queryKey: ["work-source-workshop", sourceWorkshopId],
    enabled: !!sourceWorkshopId,
    queryFn: async () => {
      const { data } = await supabase
        .from("workshops")
        .select("slug,title,visibility")
        .eq("id", sourceWorkshopId!)
        .maybeSingle();
      if (!data) return null;
      if (data.visibility !== "public" && data.visibility !== "unlisted") return null;
      return data as { slug: string; title: string; visibility: string };
    },
    staleTime: 5 * 60_000,
  });
  if (!publishedAt && !workshop) return null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
      <Calendar className="h-4 w-4" />
      {publishedAt && <span>Published {format(new Date(publishedAt), "MMM d, yyyy")}</span>}
      {workshop && (
        <>
          <span aria-hidden>·</span>
          <span>
            from Lounge{" "}
            <Link
              to="/workshops/$slug"
              params={{ slug: workshop.slug }}
              className="font-medium text-ink hover:underline underline-offset-2"
            >
              {workshop.title}
            </Link>
          </span>
        </>
      )}
    </p>
  );
}

function PinToProfileButton({
  workId,
  credits,
}: {
  workId: string;
  credits: WorkRow["work_credits"];
}) {
  const { user } = useAuth();
  const myCredit = useMemo(
    () => credits.find((c) => c.profiles?.id === user?.id),
    [credits, user?.id],
  );
  const fetchPin = useServerFn(getMyPinForWork);
  const togglePin = useServerFn(togglePinCredit);
  const [busy, setBusy] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["my-pin", workId, user?.id],
    enabled: !!user && !!myCredit,
    queryFn: () => fetchPin({ data: { workId } }),
    staleTime: 30_000,
  });

  if (!user || !myCredit || !data?.creditId) return null;

  const pinned = data.pinned;
  const onClick = async () => {
    setBusy(true);
    try {
      const res = await togglePin({ data: { creditId: data.creditId! } });
      toast.success(res.pinned ? "Pinned to your profile" : "Unpinned");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update pin");
    } finally {
      setBusy(false);
    }
  };
  const Icon = pinned ? PinOff : Pin;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={busy}
      className="rounded-full gap-1.5 text-ink-muted hover:text-ink"
      title={pinned ? "Unpin from your profile" : `Pin to your profile (${data.totalPinned}/${data.maxPins})`}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{pinned ? "Pinned" : "Pin"}</span>
    </Button>
  );
}

function BookHero({ work }: { work: WorkRow }) {
  const links = (work.book_buy_links ?? []).filter((l) => l && l.url);
  const primaryLink = links[0] ?? (work.primary_url ? { label: "Read it", url: work.primary_url } : null);
  const restLinks = primaryLink && links.length > 0 ? links.slice(1) : [];
  const meta: string[] = [];
  if (work.book_published_on) {
    try { meta.push(format(new Date(work.book_published_on), "MMM yyyy")); } catch { /* ignore */ }
  }
  if (work.book_page_count) meta.push(`${work.book_page_count} pages`);
  if (work.book_publisher) meta.push(work.book_publisher);
  if (work.book_isbn) meta.push(`ISBN ${work.book_isbn}`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
      className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,200px)_1fr] md:gap-8"
    >
      <div className="mx-auto w-full max-w-[240px] sm:mx-0">
        {work.cover_url ? (
          <img
            src={work.cover_url}
            alt={`${work.title} cover`}
            className="aspect-[2/3] w-full rounded-lg border border-border bg-cat-book object-cover shadow-lift"
          />
        ) : (
          <div className="flex aspect-[2/3] w-full items-center justify-center rounded-lg border border-cat-book-ink/20 bg-cat-book text-3xl font-display text-cat-book-ink shadow-lift">
            📖
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4">
        {primaryLink && (
          <div className="flex flex-wrap gap-2">
            <a
              href={primaryLink.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
            >
              {primaryLink.label || "Read it"} <ExternalLink className="h-4 w-4" />
            </a>
            {restLinks.map((l, i) => (
              <a
                key={`${l.label}-${i}`}
                href={l.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink hover:bg-muted"
              >
                {l.label || "Link"} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        )}
        {work.book_excerpt_url && (
          <a
            href={work.book_excerpt_url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm text-ink-soft hover:text-ink hover:bg-muted"
          >
            Read a sample <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {meta.length > 0 && (
          <p className="text-sm text-ink-muted">{meta.join(" · ")}</p>
        )}
      </div>
    </motion.div>
  );
}


