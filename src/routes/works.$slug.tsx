import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Eye, ArrowLeft, ExternalLink, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CategoryChip } from "@/components/category-chip";
import { WorkActions } from "@/components/work-actions";
import { CommentThread } from "@/components/comment-thread";
import { SOURCE_LABELS, type Category } from "@/lib/categories";
import { format } from "date-fns";

export const Route = createFileRoute("/works/$slug")({ component: WorkDetail });

type WorkRow = {
  id: string; title: string; slug: string; category: Category;
  description: string | null; excerpt: string | null;
  cover_url: string | null; primary_url: string | null; embed_url: string | null;
  source_type: string; license_type: string; published_at: string | null; created_at: string;
  like_count: number; save_count: number; view_count: number; comment_count: number;
  created_by: string;
  work_credits: { id: string; role_label: string; sort_order: number;
    profiles: { id: string; display_name: string | null; username: string | null; avatar_url: string | null; headline: string | null } | null;
  }[];
};

async function fetchWork(slug: string) {
  const { data, error } = await supabase
    .from("works")
    .select("id,title,slug,category,description,excerpt,cover_url,primary_url,embed_url,source_type,license_type,published_at,created_at,like_count,save_count,view_count,comment_count,created_by, work_credits(id,role_label,sort_order, profiles(id,display_name,username,avatar_url,headline))")
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
        </motion.header>

        {/* Cover / embed */}
        {work.cover_url && (
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
          <WorkActions workId={work.id} initialLikes={work.like_count} initialSaves={work.save_count} />
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

        {/* Credits */}
        {credits.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-2xl text-ink">Credits</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {credits.map((c) => {
                const p = c.profiles;
                const name = p?.display_name || p?.username || "Anon";
                const inner = (
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:shadow-soft">
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={p?.avatar_url ?? undefined} />
                      <AvatarFallback>{name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-ink">{name}</div>
                      <div className="truncate text-xs text-ink-muted">{c.role_label}</div>
                    </div>
                  </div>
                );
                return p?.username ? (
                  <Link key={c.id} to="/u/$username" params={{ username: p.username }}>{inner}</Link>
                ) : (
                  <div key={c.id}>{inner}</div>
                );
              })}
            </div>
          </section>
        )}

        {/* Comments */}
        <section className="mt-14">
          <CommentThread workId={work.id} />
        </section>
      </article>
    </main>
  );
}
