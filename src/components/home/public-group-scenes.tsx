import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { PublicGroupScene } from "@/lib/home-types";

/** Public Groups as creative scenes — no live, audio, or presence signals. */
export function PublicGroupScenes({ groups }: { groups: PublicGroupScene[] }) {
  if (groups.length === 0) return null;

  return (
    <section
      aria-labelledby="creative-scenes"
      className="mx-auto max-w-7xl border-b border-border px-4 py-10 md:px-6 md:py-14"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Creative scenes
          </p>
          <h2 id="creative-scenes" className="mt-1 font-display text-[26px] text-ink md:text-[32px]">
            Find the people your work belongs with.
          </h2>
          <p className="mt-2 max-w-lg text-sm text-ink-soft">
            Groups gather creative communities around places, practices, genres, and shared
            interests.
          </p>
        </div>
        <Link
          to="/groups"
          className="inline-flex items-center gap-1.5 text-sm text-ink-soft underline-offset-4 transition hover:text-ink hover:underline"
        >
          All Groups <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <Link
            key={g.id}
            to="/g/$slug"
            params={{ slug: g.slug }}
            className="group overflow-hidden rounded-lg border border-border bg-surface transition hover:border-border-strong"
          >
            <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
              {g.coverUrl ? (
                <img
                  src={g.coverUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              ) : (
                <div
                  className="h-full w-full"
                  style={{
                    background: g.accentColor
                      ? `linear-gradient(135deg, ${g.accentColor}33, ${g.accentColor}0d)`
                      : undefined,
                  }}
                />
              )}
            </div>
            <div className="p-4">
              <p className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">
                {g.kind || g.category || "Group"}
                {g.isOfficial ? " · Official" : ""}
              </p>
              <h3 className="mt-1 font-display text-[19px] leading-snug text-ink transition-colors group-hover:text-primary">
                {g.name}
              </h3>
              {g.tagline ? (
                <p className="mt-1 text-sm text-ink-soft line-clamp-2">{g.tagline}</p>
              ) : null}
              <p className="mt-3 text-[12px] text-ink-muted">
                {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
