import { Link } from "@tanstack/react-router";

import type { BlogFeedTab } from "@/lib/blog-feed.server";

export const FEED_TABS: Array<{ id: BlogFeedTab; label: string; needsAuth?: boolean }> = [
  { id: "for-you", label: "For you", needsAuth: true },
  { id: "following", label: "Following", needsAuth: true },
  { id: "featured", label: "Featured" },
  { id: "latest", label: "Latest" },
];

/**
 * The four Blog feeds. For You and Following are personalized; signed-out
 * readers still see them, and clicking prompts a sign-in through the feed body.
 */
export function BlogFeedNav({
  active,
  search,
}: {
  active: BlogFeedTab;
  search: Record<string, unknown>;
}) {
  const base = "shrink-0 border-b-2 px-1 pb-2.5 pt-1 text-[13px] font-medium transition-colors";
  const on = "border-ink text-ink";
  const off = "border-transparent text-ink-muted hover:text-ink";
  return (
    <nav aria-label="Blog feeds" className="border-b border-border">
      <div className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 pt-3 md:px-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FEED_TABS.map((t) => (
          <Link
            key={t.id}
            to="/blog"
            search={{ ...search, tab: t.id }}
            className={`${base} ${active === t.id ? on : off}`}
            aria-current={active === t.id ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
