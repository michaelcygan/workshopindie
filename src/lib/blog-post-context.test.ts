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
  it("derives mediums from Work subtypes and deduplicates them", () => {
    const ctx = deriveBlogPostContext({
      categorySlug: "film-video",
      tags: [work("1", "Short film"), work("2", "short film"), work("3", "Documentary")],
    });
    expect(ctx.mediums).toEqual(["Short film", "Documentary"]);
    expect(ctx.editorialCategory.label).toBe("Film & Video");
  });

  it("omits mediums when no linked Work has a subtype", () => {
    const ctx = deriveBlogPostContext({ categorySlug: "general", tags: [work("1", null)] });
    expect(ctx.mediums).toEqual([]);
    expect(ctx.works).toHaveLength(1);
    expect(ctx.hasContext).toBe(true);
  });

  it("drops tagged people who are already in the byline", () => {
    const ctx = deriveBlogPostContext({
      categorySlug: "general",
      tags: [person("p1", "mike"), person("p2", "jane")],
      authorProfileIds: ["p1"],
    });
    expect(ctx.people.map((p) => p.id)).toEqual(["p2"]);
  });

  it("dedupes byline people by username too", () => {
    const ctx = deriveBlogPostContext({
      categorySlug: "general",
      tags: [person("p1", "Mike")],
      authorUsernames: ["mike"],
    });
    expect(ctx.people).toEqual([]);
  });

  it("hides the whole section when only the category exists", () => {
    const ctx = deriveBlogPostContext({ categorySlug: "music", tags: [] });
    expect(ctx.hasContext).toBe(false);
    expect(ctx.editorialCategory.slug).toBe("music");
  });

  it("falls back to General for unknown categories", () => {
    expect(deriveBlogPostContext({ categorySlug: "nope", tags: [] }).editorialCategory.slug).toBe(
      "general",
    );
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
