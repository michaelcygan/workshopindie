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
  const { topic, posts } = Route.useLoaderData();
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
