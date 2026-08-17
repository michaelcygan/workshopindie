import { createFileRoute, Link } from "@tanstack/react-router";

import { listMediums } from "@/lib/topics.functions";

const SITE = "https://workshopindie.com";
const TITLE = "Mediums — Workshop";
const DESC =
  "Every craft on Workshop: film, music, writing, design, visual art, performance, software, and more. Follow a medium to shape your feed.";

export const Route = createFileRoute("/mediums/")({
  loader: async () => ({ mediums: await listMediums() }),
  head: () => {
    const url = `${SITE}/mediums`;
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
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">Mediums couldn't load.</div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">Not found.</div>
  ),
  component: MediumsIndexPage,
});

function MediumsIndexPage() {
  const { mediums } = Route.useLoaderData();
  return (
    <div className="pb-28 md:pb-16">
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Browse
          </p>
          <h1 className="mt-1.5 font-display text-[30px] leading-[1.05] tracking-tight text-ink md:text-[44px]">
            Mediums
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft md:text-[15px]">
            {DESC}
          </p>
          <Link to="/topics" className="mt-3 inline-block text-sm text-ink-soft underline">
            Browse by topic instead
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mediums.map((m) => (
            <li key={m.field_id}>
              <Link
                to="/mediums/$slug"
                params={{ slug: m.slug }}
                className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-ink/40"
              >
                <div className="font-display text-[17px] text-ink">{m.label}</div>
                {m.short_description ? (
                  <p className="mt-2 line-clamp-2 text-[13.5px] text-ink-soft">
                    {m.short_description}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
