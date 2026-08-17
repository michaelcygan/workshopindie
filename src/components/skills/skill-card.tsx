import { Link } from "@tanstack/react-router";
import { fieldLabel } from "@/lib/taxonomy";
import type { Skill } from "@/lib/skills/types";

function contextLine(work: NonNullable<Skill["work"]>): string {
  const field = fieldLabel(work.category_canonical ?? work.category);
  const format = work.subtype?.trim();
  return [field, format].filter(Boolean).join(" · ");
}

/**
 * A Skill and the Work that demonstrates it. The Skill is the subject —
 * the Work is evidence, so this is deliberately not a WorkCard.
 */
export function SkillCard({ skill }: { skill: Skill }) {
  const work = skill.work;
  if (!work) return null;

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <h3 className="font-display text-lg leading-tight text-ink">{skill.label}</h3>
      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-muted">Demonstrated in</p>
      <Link
        to="/works/$slug"
        params={{ slug: work.slug }}
        className="group mt-2 flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="h-14 w-20 shrink-0 overflow-hidden rounded-md bg-surface-2">
          {work.cover_url ? (
            <img
              src={work.cover_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : null}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink group-hover:underline">
            {work.title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-ink-muted">{contextLine(work)}</span>
        </span>
      </Link>
    </article>
  );
}

export function SkillsGrid({ skills }: { skills: Skill[] }) {
  const valid = skills.filter((s) => s.work);
  if (valid.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {valid.map((s) => (
        <SkillCard key={s.id} skill={s} />
      ))}
    </div>
  );
}
