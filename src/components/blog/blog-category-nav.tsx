import { Link } from "@tanstack/react-router";

import { BLOG_SECTIONS, type BlogSectionId } from "@/lib/blog-story-types";

/**
 * Blog Category navigation. "All" is a navigation state only — it is never
 * stored on a post, and every Category is derived from Post type.
 */
export function BlogCategoryNav({ active }: { active?: BlogSectionId | "all" }) {
  const current = active ?? "all";
  const base =
    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors";
  const on = "border-ink bg-ink text-surface";
  const off = "border-border bg-surface text-ink-soft hover:border-ink/40";

  return (
    <nav aria-label="Blog categories" className="border-b border-border">
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 md:px-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          to="/blog"
          search={{}}
          className={`${base} ${current === "all" ? on : off}`}
          aria-current={current === "all" ? "page" : undefined}
        >
          All
        </Link>
        {BLOG_SECTIONS.map((s) => (
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
