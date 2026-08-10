import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { PublicCollabCall } from "@/lib/home-types";
import { CATEGORY_LABELS, type Category } from "@/lib/categories";
import { CategoryPlaceholder } from "@/components/home/category-placeholder";

/**
 * An arts-publication "open calls" board — typography and rules only.
 * The homepage Collab query has no dependable cover image, so none is faked.
 */
export function PublicOpenCollabs({ collabs }: { collabs: PublicCollabCall[] }) {
  if (collabs.length === 0) return null;

  return (
    <section
      aria-labelledby="open-calls"
      className="mx-auto max-w-7xl border-b border-border px-4 py-10 md:px-6 md:py-14"
    >
      <div className="grid gap-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] md:gap-12">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-destructive">
            Open calls
          </p>
          <h2 id="open-calls" className="mt-1 font-display text-[26px] text-ink md:text-[32px]">
            Find your next collaborator.
          </h2>
          <p className="mt-2 max-w-xs text-sm text-ink-soft">
            Roles, projects, and invitations from people making things now.
          </p>
          <Link
            to="/collab"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink-soft underline-offset-4 transition hover:text-ink hover:underline"
          >
            Browse open Collabs <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <ul className="divide-y divide-border/70 border-t border-border/70">
          {collabs.map((c) => (
            <li key={c.id}>
              <Link
                to="/collab/$slug"
                params={{ slug: c.slug }}
                className="group flex items-start gap-3 py-5 transition md:gap-4"
              >
                <CategoryPlaceholder
                  category={c.category as Category}
                  className="mt-0.5 h-16 w-16 shrink-0 md:h-24 md:w-24"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-[0.1em] text-ink-muted">
                    <span className="text-destructive">Open</span>
                    <span aria-hidden>·</span>
                    <span>{categoryLabel(c.category)}</span>
                    <span aria-hidden>·</span>
                    <span>{c.locationLabel}</span>
                    {c.timeline ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{c.timeline}</span>
                      </>
                    ) : null}
                  </div>
                  <h3 className="mt-1.5 font-display text-[20px] leading-snug text-ink transition-colors group-hover:text-primary md:text-[24px]">
                    {c.title}
                  </h3>
                  {c.creatorName ? (
                    <p className="mt-1 text-sm text-ink-soft">by {c.creatorName}</p>
                  ) : null}
                  {c.roles.length > 0 ? (
                    <p className="mt-2 text-sm text-ink-soft">
                      Looking for {c.roles.join(", ")}
                      {c.extraRoles > 0 ? ` +${c.extraRoles} more` : ""}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
