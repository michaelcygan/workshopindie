import { describe, expect, it } from "vitest";
import { contextMentions, deriveBlogPostContext } from "@/lib/blog-post-context";
import type { BlogEntityTag } from "@/lib/blog-entity-tags";

const work = (id: string, subtype: string | null): BlogEntityTag => ({
  kind: "work",
  id,
  slug: `w-${id}`,
  label: `Work ${id}`,
  sublabel: null,
  image: null,
  work: {
    excerpt: null,
    categories: ["film"],
    subtype,
    cover_url: null,
    cover_aspect: null,
    cover_focal_x: null,
    cover_focal_y: null,
    credits: [],
  },
});

const person = (id: string, username: string): BlogEntityTag => ({
  kind: "profile",
  id,
  username,
  label: username,
  sublabel: null,
  image: null,
});

describe("deriveBlogPostContext", () => {
  it("derives Post type, Category and Subjects — and never a Medium", () => {
    const ctx = deriveBlogPostContext({
      storyType: "interview",
      fields: ["film_video"],
      subjects: ["Process", "Money"],
      tags: [work("1", "Short film"), work("2", "short film")],
    });
    expect(ctx.classification.postTypeLabel).toBe("Interview");
    expect(ctx.classification.section?.id).toBe("interviews");
    expect(ctx.classification.subjects).toEqual(["Process", "Money"]);
    expect(ctx).not.toHaveProperty("mediums");
  });

  it("renders taxonomy even with zero linked entities", () => {
    const ctx = deriveBlogPostContext({ storyType: "essay", tags: [] });
    expect(ctx.hasEntities).toBe(false);
    expect(ctx.hasContext).toBe(true);
  });

  it("hydrates the Post type from legacy story_types", () => {
    const ctx = deriveBlogPostContext({ storyTypes: ["journal", "essay"], tags: [] });
    expect(ctx.classification.postType).toBe("journal");
    expect(ctx.classification.section?.id).toBe("field-notes");
  });

  it("drops tagged people who are already in the byline", () => {
    const ctx = deriveBlogPostContext({
      tags: [person("p1", "mike"), person("p2", "jane")],
      authorProfileIds: ["p1"],
    });
    expect(ctx.people.map((p) => p.id)).toEqual(["p2"]);
  });

  it("dedupes byline people by username too", () => {
    const ctx = deriveBlogPostContext({
      tags: [person("p1", "Mike")],
      authorUsernames: ["mike"],
    });
    expect(ctx.people).toEqual([]);
  });

  it("hides the whole section for an untyped post with nothing linked", () => {
    const ctx = deriveBlogPostContext({ categorySlug: "general", tags: [] });
    expect(ctx.hasContext).toBe(false);
  });


  it("emits mentions matching what the section renders", () => {
    const ctx = deriveBlogPostContext({
      categorySlug: "general",
      tags: [work("1", "Short film"), person("p1", "jane")],
      authorProfileIds: [],
    });
    expect(contextMentions(ctx, "https://x.test")).toEqual([
      { "@type": "CreativeWork", name: "Work 1", url: "https://x.test/works/w-1" },
      { "@type": "Person", name: "jane", url: "https://x.test/jane" },
    ]);
  });
});
