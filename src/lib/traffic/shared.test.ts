import { describe, expect, it } from "vitest";
import {
  isExcludedTrafficPath,
  normalizeRoutePattern,
  normalizeTrafficPath,
} from "./shared";

describe("traffic path normalization", () => {
  it("keeps only the pathname", () => {
    expect(normalizeTrafficPath("/groups?t=city")).toBe("/groups");
    expect(normalizeTrafficPath("/blog/a#notes")).toBe("/blog/a");
    expect(normalizeTrafficPath("/g/chicago/")).toBe("/g/chicago");
    expect(normalizeTrafficPath("/")).toBe("/");
  });

  it("rejects non-paths", () => {
    expect(normalizeTrafficPath("https://evil.com/x")).toBeNull();
    expect(normalizeTrafficPath("")).toBeNull();
  });

  it("query-only changes collapse to one page", () => {
    expect(normalizeTrafficPath("/groups?t=city")).toBe(normalizeTrafficPath("/groups?t=genre"));
  });
});

describe("excluded surfaces", () => {
  it("excludes private and operational routes", () => {
    for (const p of [
      "/admin",
      "/admin/traffic",
      "/dms",
      "/dms/abc",
      "/settings",
      "/auth/callback",
      "/reset-password",
      "/forgot-password",
      "/go/chicago-card",
      "/api/public/traffic",
    ]) {
      expect(isExcludedTrafficPath(p), p).toBe(true);
    }
  });

  it("keeps public product pages", () => {
    for (const p of ["/", "/blog", "/blog/what-is-a-plugin", "/groups", "/g/chicago", "/works/x"]) {
      expect(isExcludedTrafficPath(p), p).toBe(false);
    }
  });
});

describe("route patterns", () => {
  it("normalizes router ids", () => {
    expect(normalizeRoutePattern("/blog/$slug")).toBe("/blog/:slug");
    expect(normalizeRoutePattern("/_authenticated/me")).toBe("/me");
    expect(normalizeRoutePattern("/")).toBe("/");
    expect(normalizeRoutePattern(null)).toBeNull();
  });
});

/**
 * The metric definitions the admin page promises, checked against the same
 * deterministic fixture used to verify the SQL:
 *   A: / → /blog → /blog/a   B: /works/x   C: / → /groups
 */
describe("metric definitions", () => {
  const views = [
    { s: "A", p: "/" },
    { s: "A", p: "/blog" },
    { s: "A", p: "/blog/a" },
    { s: "B", p: "/works/x" },
    { s: "C", p: "/" },
    { s: "C", p: "/groups" },
  ];

  it("matches the documented fixture", () => {
    const sessions = new Map<string, number>();
    for (const v of views) sessions.set(v.s, (sessions.get(v.s) ?? 0) + 1);
    const pageViews = views.length;
    const visits = sessions.size;
    const bounced = [...sessions.values()].filter((n) => n === 1).length;

    expect(pageViews).toBe(6);
    expect(visits).toBe(3);
    expect(bounced).toBe(1);
    expect(Math.round((bounced / visits) * 1000) / 10).toBe(33.3);
    expect(pageViews / visits).toBe(2);
  });
});
