import { createFileRoute } from "@tanstack/react-router";
import { BlogPostContext } from "@/components/blog-post-context";
import { deriveBlogPostContext } from "@/lib/blog-post-context";
import type { BlogEntityTag } from "@/lib/blog-entity-tags";

export const Route = createFileRoute("/ctx-preview")({ component: Page });

const tags: BlogEntityTag[] = [
  {
    kind: "work",
    id: "1",
    slug: "jesus-christ-diva",
    label: "Jesus Christ Diva",
    sublabel: null,
    image: null,
    work: {
      excerpt: "A short film shot over two days on the north side of Chicago.",
      categories: ["film"],
      subtype: "Short film",
      cover_url: "https://picsum.photos/seed/a/640/400",
      cover_aspect: null,
      cover_focal_x: null,
      cover_focal_y: null,
      credits: [
        { id: "c1", username: "mike", display_name: "Michael Cygan", avatar_url: null, role_label: "Director" },
      ],
    },
  },
  { kind: "profile", id: "p1", username: "jane", label: "Jane Doe", sublabel: "Cinematographer", image: null },
  { kind: "collab", id: "cl1", slug: "casting-chicago", label: "Casting Chicago Performers", sublabel: "Looking for actors for a short film", image: null },
  { kind: "group", id: "g1", slug: "indie-filmmakers", label: "Chicago Filmmakers", sublabel: "Independent filmmakers in Chicago", image: null },
  { kind: "event", id: "e1", slug: "open-mic", groupSlug: "chicago", label: "Open Mic at Murphy's", sublabel: "Chicago", image: null },
];

function Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <BlogPostContext context={deriveBlogPostContext({ categorySlug: "film-video", tags })} />
    </div>
  );
}
