import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { BlogEntityTag, BlogWorkSummary } from "@/lib/blog-entity-tags";

type RichWork = Extract<BlogEntityTag, { kind: "work" }> & { work: BlogWorkSummary };

function label(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function WorkCard({ tag }: { tag: RichWork }) {
  const w = tag.work;
  const credits = w.credits.filter((c) => c.display_name || c.username);
  return (
    <Link
      to="/works/$slug"
      params={{ slug: tag.slug }}
      className="group flex flex-col gap-4 rounded-xl border border-border bg-surface p-3 transition hover:border-ink/20 hover:shadow-soft sm:flex-row sm:items-center sm:p-4"
    >
      <div className="w-full shrink-0 overflow-hidden rounded-2xl bg-muted sm:w-40">
        {w.cover_url ? (
          <img
            src={w.cover_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="aspect-[16/10] w-full object-cover"
            style={{
              objectPosition:
                w.cover_focal_x != null && w.cover_focal_y != null
                  ? `${w.cover_focal_x * 100}% ${w.cover_focal_y * 100}%`
                  : undefined,
            }}
          />
        ) : (
          <div className="aspect-[16/10] w-full bg-secondary" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {w.categories.length > 0 && (
          <div className="text-[11px] uppercase tracking-wider text-ink-muted">
            {w.categories.slice(0, 2).map(label).join(" · ")}
          </div>
        )}
        <div className="mt-1 font-display text-lg leading-snug text-ink group-hover:underline">{tag.label}</div>
        {w.excerpt && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{w.excerpt}</p>}

        <div className="mt-3 flex items-center justify-between gap-3">
          {credits.length > 0 ? (
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex -space-x-2">
                {credits.map((c) => (
                  <Avatar key={c.id} className="h-6 w-6 border border-surface">
                    {c.avatar_url ? <AvatarImage src={c.avatar_url} alt="" /> : null}
                    <AvatarFallback className="text-[9px]">
                      {(c.display_name || c.username || "?").slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="truncate text-xs text-ink-muted">
                {credits
                  .map((c) => (c.display_name || c.username) + (c.role_label ? ` · ${c.role_label}` : ""))
                  .join(", ")}
              </span>
            </div>
          ) : (
            <span />
          )}
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-soft group-hover:text-ink">
            View Work <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * "Work in this story" — rich context cards for Works tagged on a blog post.
 * Only Works with a resolved public summary render here; anything else stays
 * in the plain chip strip at the bottom of the article.
 */
export function BlogWorkContext({ tags, className }: { tags: BlogEntityTag[]; className?: string }) {
  const works = tags.filter(
    (t): t is RichWork => t.kind === "work" && !!(t as { work?: BlogWorkSummary | null }).work,
  );
  if (works.length === 0) return null;
  const shown = works.slice(0, 3);

  return (
    <section className={className ?? "mt-8"}>
      <div className="mb-3 text-[11px] uppercase tracking-wider text-ink-muted">
        {shown.length === 1 ? "Work in this story" : "Works in this story"}
      </div>
      <div className="grid gap-3">
        {shown.map((t) => (
          <WorkCard key={t.id} tag={t} />
        ))}
      </div>
    </section>
  );
}
