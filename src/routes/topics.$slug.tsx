import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { BlogFeedList } from "@/components/blog/blog-feed-cards";
import { FollowTopicButton } from "@/components/topics/follow-topic-button";
import { getTopicHub } from "@/lib/topics.functions";

const SITE = "https://workshopindie.com";

export const Route = createFileRoute("/topics/$slug")({
  loader: async ({ params }) => {
    const hub = await getTopicHub({ data: { slug: params.slug } });
    if (!hub.topic) throw notFound();
    return hub;
  },
  head: ({ params, loaderData }) => {
    if (!loaderData?.topic) {
      return { meta: [{ title: "Topic not found — Workshop" }, { name: "robots", content: "noindex" }] };
    }
    const t = loaderData.topic;
    const title = `${t.name} — Workshop`;
    const desc =
      t.short_description ??
      `Stories, essays, and process notes about ${t.name} from independent makers on Workshop.`;
    const url = `${SITE}/topics/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: t.name,
            url,
            description: desc,
          }),
        },
      ],
    };
  },
  errorComponent: () => <HubMessage title="This topic couldn't load." />,
  notFoundComponent: () => <HubMessage title="No such topic." />,
  component: TopicHubPage,
});

function HubMessage({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center md:px-6">
      <h1 className="font-display text-2xl text-ink">{title}</h1>
      <Link to="/topics" className="mt-4 inline-block text-sm text-ink-soft underline">
        Browse all topics
      </Link>
    </div>
  );
}

function TopicHubPage() {
  const { topic, posts, entities } = Route.useLoaderData();
  if (!topic) return <HubMessage title="No such topic." />;

  return (
    <div className="pb-28 md:pb-16">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-4 px-4 py-8 md:px-6 md:py-12">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Topic
            </p>
            <h1 className="mt-1.5 font-display text-[30px] leading-[1.05] tracking-tight text-ink md:text-[44px]">
              {topic.name}
            </h1>
            {topic.short_description ? (
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft md:text-[15px]">
                {topic.short_description}
              </p>
            ) : null}
          </div>
          <FollowTopicButton kind="topic" topicId={topic.id} label={topic.name} />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-10">
        {topic.about_markdown ? (
          <section className="mb-8 rounded-xl border border-border bg-surface-2/40 p-5 md:p-6">
            <h2 className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">
              About this topic
            </h2>
            <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-ink-soft">
              {topic.about_markdown}
            </p>
          </section>
        ) : null}

        {entities.works.length > 0 ? (
          <HubSection title="Works">
            {entities.works.map((w) => (
              <HubCard
                key={w.id}
                to="/works/$slug"
                params={{ slug: w.slug }}
                title={w.title}
                meta={w.category_canonical}
                image={w.cover_url}
              />
            ))}
          </HubSection>
        ) : null}

        {entities.events.length > 0 ? (
          <HubSection title="Upcoming events">
            {entities.events.map((e) => (
              <HubCard
                key={e.id}
                to="/e/$slug"
                params={{ slug: e.slug ?? e.id }}
                title={e.title}
                meta={new Date(e.starts_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
                image={e.cover_url}
              />
            ))}
          </HubSection>
        ) : null}

        {entities.collabs.length > 0 ? (
          <HubSection title="Open collabs">
            {entities.collabs.map((c) => (
              <HubCard
                key={c.id}
                to="/collab/$slug"
                params={{ slug: c.slug }}
                title={c.title}
                meta={c.category_canonical}
                image={null}
              />
            ))}
          </HubSection>
        ) : null}

        {entities.groups.length > 0 ? (
          <HubSection title="Groups">
            {entities.groups.map((g) => (
              <HubCard
                key={g.id}
                to="/g/$slug"
                params={{ slug: g.slug }}
                title={g.name}
                meta={g.kind}
                image={null}
              />
            ))}
          </HubSection>
        ) : null}

        <h2 className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-muted">Stories</h2>
        <BlogFeedList
          posts={posts}
          emptyTitle="No stories on this topic yet."
          emptyBody="Publish one and it will show up here."
        />
      </div>
    </div>
  );
}

function HubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ink-muted">{title}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
    </section>
  );
}

function HubCard({
  to,
  params,
  title,
  meta,
  image,
}: {
  to: string;
  params: Record<string, string>;
  title: string;
  meta?: string | null;
  image?: string | null;
}) {
  return (
    <Link
      // Typed routes vary by entity kind; params are validated by the loader data.
      to={to as never}
      params={params as never}
      className="group block overflow-hidden rounded-xl border border-border bg-surface"
    >
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          className="aspect-[16/10] w-full object-cover"
        />
      ) : (
        <div className="aspect-[16/10] w-full bg-surface-2" />
      )}
      <div className="p-3">
        <p className="line-clamp-2 text-[13.5px] font-medium text-ink group-hover:underline">
          {title}
        </p>
        {meta ? (
          <p className="mt-1 truncate text-[11px] uppercase tracking-[0.1em] text-ink-muted">
            {meta.replace(/_/g, " ")}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

