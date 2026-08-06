import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Trust resolution decides who is allowed to speak *for* an entity on that
 * entity's own page. These tests pin the per-kind membership rules with a
 * hand-rolled stub of the admin client's query builder.
 */

type Tables = Record<string, Array<Record<string, unknown>>>;

let tables: Tables = {};

function makeBuilder(name: string) {
  let rows = [...(tables[name] ?? [])];
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      rows = rows.filter((r) => r[col] === val);
      return builder;
    },
    in: (col: string, vals: unknown[]) => {
      rows = rows.filter((r) => vals.includes(r[col]));
      return builder;
    },
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: rows, error: null }),
  };
  return builder;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (name: string) => makeBuilder(name) },
}));

const { resolveTrustedAuthorIds } = await import("@/lib/blog-entity-tags.server");

beforeEach(() => {
  tables = {};
});

describe("resolveTrustedAuthorIds", () => {
  it("work: creator plus credited collaborators, with role labels", async () => {
    tables = {
      works: [{ id: "w1", created_by: "owner" }],
      work_credits: [
        { work_id: "w1", user_id: "editor", role_label: "Editor" },
        { work_id: "w1", user_id: "sound", role_label: null },
      ],
    };
    const { trusted, creditRole } = await resolveTrustedAuthorIds("work", "w1");
    expect([...trusted].sort()).toEqual(["editor", "owner", "sound"]);
    expect(creditRole.get("editor")).toBe("Editor");
    expect(creditRole.has("sound")).toBe(false);
  });

  it("collab: owner plus accepted invitees only", async () => {
    tables = {
      collab_posts: [{ id: "c1", user_id: "owner" }],
      collab_invites: [
        { collab_post_id: "c1", invitee_user_id: "joined", status: "accepted" },
        { collab_post_id: "c1", invitee_user_id: "pending", status: "pending" },
        { collab_post_id: "c1", invitee_user_id: "declined", status: "declined" },
      ],
    };
    const { trusted } = await resolveTrustedAuthorIds("collab", "c1");
    expect([...trusted].sort()).toEqual(["joined", "owner"]);
  });

  it("event: organizer, co-hosts and the parent group's stewards", async () => {
    tables = {
      group_events: [{ id: "e1", created_by: "organizer", group_id: "g1" }],
      group_event_cohosts: [{ event_id: "e1", user_id: "cohost" }],
      groups: [{ id: "g1", created_by: "founder" }],
      group_members: [
        { group_id: "g1", user_id: "steward", role: "steward" },
        { group_id: "g1", user_id: "member", role: "member" },
      ],
    };
    const { trusted } = await resolveTrustedAuthorIds("event", "e1");
    expect([...trusted].sort()).toEqual(["cohost", "founder", "organizer", "steward"]);
    expect(trusted.has("member")).toBe(false);
  });

  it("group: founder and stewards, not plain members", async () => {
    tables = {
      groups: [{ id: "g1", created_by: "founder" }],
      group_members: [
        { group_id: "g1", user_id: "owner2", role: "owner" },
        { group_id: "g1", user_id: "member", role: "member" },
      ],
    };
    const { trusted } = await resolveTrustedAuthorIds("group", "g1");
    expect([...trusted].sort()).toEqual(["founder", "owner2"]);
  });

  it("profile: only the person themselves", async () => {
    const { trusted } = await resolveTrustedAuthorIds("profile", "p1");
    expect([...trusted]).toEqual(["p1"]);
  });

  it("an unrelated tagger is never trusted", async () => {
    tables = {
      works: [{ id: "w1", created_by: "owner" }],
      work_credits: [],
    };
    const { trusted } = await resolveTrustedAuthorIds("work", "w1");
    expect(trusted.has("stranger")).toBe(false);
  });
});
