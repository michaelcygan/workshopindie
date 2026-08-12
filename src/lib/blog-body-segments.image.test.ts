import { describe, it, expect } from "vitest";
import { parseSegments, serializeSegments } from "@/lib/blog-body-segments";
describe("image marker", () => {
  it("round-trips", () => {
    const md = serializeSegments([
      { type: "text", text: "Hello" },
      { type: "image", image: { url: "https://x.com/a b.jpg", alt: "A|B", caption: "Cap]", link: "/u/mike" } },
      { type: "text", text: "Bye" },
    ]);
    const segs = parseSegments(md);
    expect(segs.filter((s) => s.type === "image")).toHaveLength(1);
    expect(segs[1]).toEqual({ type: "image", image: { url: "https://x.com/a b.jpg", alt: "A|B", caption: "Cap]", link: "/u/mike" } });
    expect(serializeSegments(segs)).toBe(md);
  });
});
