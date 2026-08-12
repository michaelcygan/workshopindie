import { describe, expect, it } from "vitest";
import { parseSegments, serializeSegments } from "./blog-body-segments";

describe("gallery markers", () => {
  it("round-trips a gallery block through parse/serialize", () => {
    const gallery = {
      items: [
        { url: "https://cdn.test/a.jpg", alt: "A | pipe" },
        { url: "https://cdn.test/b.jpg" },
      ],
      layout: "slideshow" as const,
      caption: "Backstage",
    };
    const md = serializeSegments([
      { type: "text", text: "Before" },
      { type: "gallery", gallery },
      { type: "text", text: "After" },
    ]);
    const segs = parseSegments(md);
    const found = segs.find((s) => s.type === "gallery");
    expect(found).toBeTruthy();
    expect(found && found.type === "gallery" && found.gallery).toEqual(gallery);
    expect(segs.filter((s) => s.type === "text").map((s) => (s.type === "text" ? s.text : "")).join("|")).toContain(
      "Before",
    );
  });
});
