import { describe, it, expect } from "vitest";
import { workshopEntityUrl, makeEntityRef, entityMarkdown } from "./kinds";

describe("workshopEntityUrl", () => {
  it("resolves every entity kind to its canonical path", () => {
    expect(workshopEntityUrl({ kind: "profile", username: "jane" })).toBe("/u/jane");
    expect(workshopEntityUrl({ kind: "work", slug: "my-film" })).toBe("/works/my-film");
    expect(workshopEntityUrl({ kind: "post", slug: "a-story" })).toBe("/blog/a-story");
    expect(workshopEntityUrl({ kind: "collab", slug: "casting" })).toBe("/collab/casting");
    expect(workshopEntityUrl({ kind: "group", slug: "chicago" })).toBe("/g/chicago");
    expect(workshopEntityUrl({ kind: "event", slug: "open-mic", groupSlug: "chicago" })).toBe(
      "/g/chicago/e/open-mic",
    );
  });

  it("fills url on refs and produces the stored markdown format", () => {
    const ref = makeEntityRef({ kind: "work", slug: "my-film" }, { id: "w1", label: "My Film" });
    expect(ref.url).toBe("/works/my-film");
    expect(entityMarkdown(ref)).toBe("[My Film](/works/my-film)");
  });
});
