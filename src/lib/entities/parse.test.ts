import { describe, it, expect } from "vitest";
import { parseEntityBody, flattenEntityBody, extractBodyMentions } from "./parse";

describe("parseEntityBody", () => {
  it("recognises every inline entity kind, including Works", () => {
    const body =
      "hey @jane look at [My Film](/works/my-film) and [Casting](/collab/casting) in [Chicago](/g/chicago) at [Open Mic](/g/chicago/e/open-mic) — see [Story](/blog/a-story)";
    const segs = parseEntityBody(body);
    const entities = segs.filter((s) => s.type === "entity");
    expect(entities.map((e) => (e as { kind: string }).kind)).toEqual([
      "work",
      "collab",
      "group",
      "event",
      "post",
    ]);
    expect(segs.some((s) => s.type === "mention" && s.username === "jane")).toBe(true);
  });

  it("keeps event links from being swallowed by the group pattern", () => {
    const segs = parseEntityBody("[Open Mic](/g/chicago/e/open-mic)");
    expect(segs).toEqual([
      { type: "entity", kind: "event", label: "Open Mic", slug: "open-mic", groupSlug: "chicago" },
    ]);
  });

  it("leaves plain text untouched", () => {
    expect(parseEntityBody("just a normal message")).toEqual([
      { type: "text", value: "just a normal message" },
    ]);
  });

  it("autolinks bare hostnames only when asked", () => {
    expect(parseEntityBody("visit www.example.com").some((s) => s.type === "url")).toBe(false);
    expect(
      parseEntityBody("visit www.example.com", { bareUrls: true }).some((s) => s.type === "url"),
    ).toBe(true);
  });

  it("flattens links to labels and extracts mentions", () => {
    expect(flattenEntityBody("see [My Film](/works/my-film)")).toBe("see My Film");
    expect(extractBodyMentions("hi @Jane and @bob")).toEqual(["jane", "bob"]);
  });
});
