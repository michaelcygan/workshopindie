import { describe, it, expect } from "vitest";
import { quickWorkSchema } from "./works-quick.functions";

describe("quickWorkSchema", () => {
  it("accepts a minimal Work", () => {
    const parsed = quickWorkSchema.parse({ title: "  Night Bus  ", category: "film_video" });
    expect(parsed).toEqual({
      title: "Night Bus",
      category: "film_video",
      subtype: null,
      primary_url: null,
    });
  });

  it("keeps the format so mediums can be derived", () => {
    expect(quickWorkSchema.parse({ title: "T", category: "music", subtype: "Remix" }).subtype).toBe(
      "Remix",
    );
  });

  it("rejects an empty title, a non-Work category, and a bad link", () => {
    expect(() => quickWorkSchema.parse({ title: "  ", category: "film_video" })).toThrow();
    expect(() => quickWorkSchema.parse({ title: "T", category: "critique" })).toThrow();
    expect(() =>
      quickWorkSchema.parse({ title: "T", category: "film_video", primary_url: "not a url" }),
    ).toThrow();
  });
});
