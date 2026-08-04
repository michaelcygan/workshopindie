import { Link } from "@tanstack/react-router";

import { BLOG_CATEGORIES, type BlogCategorySlug } from "@/lib/blog-categories";

/**
 * Blog taxonomy navigation. "All" is a navigation state only — it is never
 * stored on a post.
 */
export function BlogCategoryNav({ active }: { active?: BlogCategorySlug | "all" }) {
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
        {BLOG_CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            to="/blog/c/$category"
            params={{ category: c.slug }}
            search={{}}
            className={`${base} ${current === c.slug ? on : off}`}
            aria-current={current === c.slug ? "page" : undefined}
          >
            {c.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
