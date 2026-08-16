import { Link } from "@tanstack/react-router";

import { BLOG_SECTIONS, type BlogSectionId } from "@/lib/blog-story-types";

/**
 * Blog Category navigation. "General" is a navigation state only — it is never
 * stored on a post, and every Category is derived from Post type.
 *
 * The rail stays short on purpose: the three sections readers actually browse
 * by. Other Categories remain reachable by URL and from post eyebrows.
 */
const RAIL: BlogSectionId[] = ["essays", "field-notes", "interviews"];

export function BlogCategoryNav({ active }: { active?: BlogSectionId | "all" }) {
  const current = active ?? "all";
  const base =
    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors";
  const on = "border-ink bg-ink text-surface";
  const off = "border-border bg-surface text-ink-soft hover:border-ink/40";

  const sections = RAIL.map((id) => BLOG_SECTIONS.find((s) => s.id === id)!).filter(Boolean);
  const extra =
    current !== "all" && !RAIL.includes(current as BlogSectionId)
      ? BLOG_SECTIONS.filter((s) => s.id === current)
      : [];

  return (
    <nav aria-label="Blog categories" className="border-b border-border">
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 md:px-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          to="/blog"
          search={{}}
          className={`${base} ${current === "all" ? on : off}`}
          aria-current={current === "all" ? "page" : undefined}
        >
          General
        </Link>
        {[...sections, ...extra].map((s) => (
          <Link
            key={s.id}
            to="/blog/category/$category"
            params={{ category: s.id }}
            search={{}}
            className={`${base} ${current === s.id ? on : off}`}
            aria-current={current === s.id ? "page" : undefined}
          >
            {s.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
