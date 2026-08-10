import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, BookOpen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BlogPostPeek } from "@/components/blog-post-peek";
import { HomeSection } from "@/components/home-section";
import { CategoryPlaceholder } from "@/components/home/category-placeholder";

import { listHomeWorkStories } from "@/lib/home.functions";
import { HOME_STORY_LABEL_TEXT, type HomeWorkStory } from "@/lib/home-types";
import { categoryLabel } from "@/lib/taxonomy";

function fieldLabelText(id: string) {
  return categoryLabel(id);
}

function StoryCard({ item, onPeek }: { item: HomeWorkStory; onPeek: (slug: string) => void }) {
  const w = item.work;
  const lead = item.stories[0];
  const rest = item.stories.slice(1);

  return (
    <article className="flex w-[86vw] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-ink/20 hover:shadow-soft sm:w-[420px]">
      <Link
        to="/works/$slug"
        params={{ slug: w.slug }}
        className="group block overflow-hidden bg-muted"
        aria-label={`View ${w.title}`}
      >
        {w.cover_url ? (
          <img
            src={w.cover_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            style={{
              objectPosition:
                w.cover_focal_x != null && w.cover_focal_y != null
                  ? `${w.cover_focal_x}% ${w.cover_focal_y}%`
                  : undefined,
            }}
          />
        ) : (
          <CategoryPlaceholder
            size="cover"
            category={w.categories[0]}
            className="aspect-[16/10] w-full"
          />
        )}

      </Link>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div>
          {w.categories.length > 0 && (
            <div className="text-[11px] uppercase tracking-wider text-ink-muted">
              {w.categories.slice(0, 2).map(categoryLabel).join(" · ")}
            </div>
          )}
          <Link
            to="/works/$slug"
            params={{ slug: w.slug }}
            className="mt-1 block font-display text-xl leading-snug text-ink hover:underline"
          >
            {w.title}
          </Link>
          {item.credits.length > 0 && (
            <div className="mt-2 flex min-w-0 items-center gap-2">
              <div className="flex -space-x-2">
                {item.credits.map((c) => (
                  <Avatar key={c.id || c.username} className="h-5 w-5 border border-surface">
                    {c.avatar_url ? <AvatarImage src={c.avatar_url} alt="" /> : null}
                    <AvatarFallback className="text-[8px]">
                      {(c.display_name || c.username || "?").slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="truncate text-xs text-ink-muted">
                {item.credits.map((c) => c.display_name || c.username).join(", ")}
              </span>
            </div>
          )}
        </div>

        {lead && (
          <button
            type="button"
            onClick={() => onPeek(lead.slug)}
            className="rounded-2xl border border-border bg-canvas/60 p-3 text-left transition hover:border-ink/20"
          >
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-muted">
              <BookOpen className="h-3 w-3" />
              {HOME_STORY_LABEL_TEXT[lead.label]}
            </span>
            <span className="mt-1 block text-sm font-medium leading-snug text-ink">
              {lead.title}
            </span>
            {lead.excerpt && (
              <span className="mt-1 line-clamp-2 block text-xs text-ink-soft">{lead.excerpt}</span>
            )}
          </button>
        )}

        {rest.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {rest.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onPeek(s.slug)}
                className="max-w-full truncate rounded-full border border-border px-3 py-1 text-xs text-ink-soft transition hover:border-ink/20 hover:text-ink"
              >
                {s.title}
              </button>
            ))}
          </div>
        )}

        <Link
          to="/works/$slug"
          params={{ slug: w.slug }}
          className="mt-auto inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink"
        >
          View the Work <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

/**
 * "Stories around the Work" — the reciprocal Work ↔ Blog graph, surfaced as a
 * single composite rail. Renders nothing until there is real connected
 * content, so an empty graph never leaves a hole in the page.
 */
export function WorkStoriesCarousel({ className }: { className?: string }) {
  const listFn = useServerFn(listHomeWorkStories);
  const [peekSlug, setPeekSlug] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["home-work-stories"],
    queryFn: () => listFn(),
    staleTime: 5 * 60_000,
  });

  const items = (q.data ?? []) as HomeWorkStory[];
  if (items.length === 0) return null;

  return (
    <HomeSection
      className={className}
      eyebrow="The connected graph"
      title="Stories around the Work"
      kicker="Process notes and essays written by the people who made these."
      href="/blog"
      cta="All stories"
    >
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
        {items.map((item) => (
          <StoryCard key={item.work.id} item={item} onPeek={setPeekSlug} />
        ))}
      </div>

      <BlogPostPeek
        slug={peekSlug}
        open={!!peekSlug}
        onOpenChange={(v) => !v && setPeekSlug(null)}
        onSelectPost={(slug) => setPeekSlug(slug)}
      />
    </HomeSection>
  );
}
