import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { fieldLabel } from "@/lib/taxonomy";
import type { Skill, SkillWork } from "@/lib/skills/types";

const VISIBLE = 3;

function contextLine(work: SkillWork): string {
  const field = fieldLabel(work.category_canonical ?? work.category);
  const format = work.subtype?.trim();
  return [field, format].filter(Boolean).join(" · ");
}

function WorkRow({ work }: { work: SkillWork }) {
  return (
    <Link
      to="/works/$slug"
      params={{ slug: work.slug }}
      className="group flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  );
}

/**
 * A Skill and the Works that demonstrate it. The Skill is the subject —
 * the Works are evidence, so this is deliberately not a WorkCard.
 */
export function SkillCard({ skill }: { skill: Skill }) {
  const [expanded, setExpanded] = useState(false);
  const works = skill.works;
  if (works.length === 0) return null;

  const shown = expanded ? works : works.slice(0, VISIBLE);
  const hidden = works.length - shown.length;

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <h3 className="font-display text-lg leading-tight text-ink">{skill.label}</h3>
      {skill.description ? (
        <p className="mt-1.5 text-sm leading-snug text-ink-soft">{skill.description}</p>
      ) : null}
      <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-ink-muted">Demonstrated in</p>
      <div className="mt-2 space-y-2">
        {shown.map((w) => (
          <WorkRow key={w.id} work={w} />
        ))}
      </div>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 text-xs text-ink-muted underline-offset-2 hover:underline"
        >
          +{hidden} more
        </button>
      ) : null}
    </article>
  );
}

export function SkillsGrid({ skills }: { skills: Skill[] }) {
  const valid = skills.filter((s) => s.works.length > 0);
  if (valid.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {valid.map((s) => (
        <SkillCard key={s.id} skill={s} />
      ))}
    </div>
  );
}
