import { createFileRoute, Link } from "@tanstack/react-router";

import { listTrendingTopics } from "@/lib/topics.functions";

const SITE = "https://workshopindie.com";
const TITLE = "Topics — Workshop";
const DESC =
  "Browse what independent makers are writing about: process, craft, money, community, tools, and the scenes they build.";

export const Route = createFileRoute("/topics/")({
  loader: async () => ({ topics: await listTrendingTopics({ data: { limit: 50 } }) }),
  head: () => {
    const url = `${SITE}/topics`;
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESC },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESC },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESC },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">Topics couldn't load.</div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">Not found.</div>
  ),
  component: TopicsIndexPage,
});

function TopicsIndexPage() {
  const { topics } = Route.useLoaderData();
  return (
    <div className="pb-28 md:pb-16">
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Browse
          </p>
          <h1 className="mt-1.5 font-display text-[30px] leading-[1.05] tracking-tight text-ink md:text-[44px]">
            Topics
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft md:text-[15px]">
            {DESC}
          </p>
          <Link to="/mediums" className="mt-3 inline-block text-sm text-ink-soft underline">
            Browse by medium instead
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
        {topics.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-ink-muted">
            No topics yet.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((t) => (
              <li key={t.id}>
                <Link
                  to="/topics/$slug"
                  params={{ slug: t.slug }}
                  className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-ink/40"
                >
                  <div className="font-display text-[17px] text-ink">{t.name}</div>
                  <div className="mt-1 text-[12px] uppercase tracking-[0.1em] text-ink-muted">
                    {t.count} {t.count === 1 ? "story" : "stories"}
                  </div>
                  {t.short_description ? (
                    <p className="mt-2 line-clamp-2 text-[13.5px] text-ink-soft">
                      {t.short_description}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
