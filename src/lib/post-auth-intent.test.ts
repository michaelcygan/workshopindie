import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  INTENT_KEY,
  parseIntent,
  serializeIntent,
  setPostAuthIntent,
  peekPostAuthIntent,
  clearPostAuthIntent,
  consumePostAuthIntent,
  migrateLegacyIntents,
  __resetIntentGuards,
} from "./post-auth-intent";

beforeEach(() => {
  sessionStorage.clear();
  __resetIntentGuards();
});

describe("post-auth intent", () => {
  it("serializes and reads a valid intent", () => {
    setPostAuthIntent({ kind: "event_rsvp", payload: { event_id: "e1", status: "going" }, returnTo: "/e/abc" });
    const intent = peekPostAuthIntent();
    expect(intent?.kind).toBe("event_rsvp");
    expect(intent?.payload.event_id).toBe("e1");
    expect(intent?.returnTo).toBe("/e/abc");
  });

  it("rejects malformed intents", () => {
    sessionStorage.setItem(INTENT_KEY, "{not json");
    expect(peekPostAuthIntent()).toBeNull();
    sessionStorage.setItem(INTENT_KEY, JSON.stringify({ v: 99, kind: "return_to" }));
    expect(peekPostAuthIntent()).toBeNull();
  });

  it("rejects expired intents", () => {
    const stale = serializeIntent({ kind: "return_to", returnTo: "/groups" }, Date.now() - 60 * 60 * 1000);
    sessionStorage.setItem(INTENT_KEY, JSON.stringify(stale));
    expect(peekPostAuthIntent()).toBeNull();
  });

  it("rejects an unsafe return path", () => {
    const intent = serializeIntent({ kind: "return_to", returnTo: "/ok" });
    sessionStorage.setItem(INTENT_KEY, JSON.stringify({ ...intent, returnTo: "//evil.example" }));
    expect(peekPostAuthIntent()).toBeNull();
  });

  it("falls back to / for an unsafe return path at write time", () => {
    setPostAuthIntent({ kind: "return_to", returnTo: "https://evil.example" });
    expect(peekPostAuthIntent()?.returnTo).toBe("/");
  });

  it("consumes only once", async () => {
    setPostAuthIntent({ kind: "follow_user", payload: { userId: "u1" }, returnTo: "/u/x" });
    const run = vi.fn().mockResolvedValue(undefined);
    await consumePostAuthIntent("me", run);
    await consumePostAuthIntent("me", run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(peekPostAuthIntent()).toBeNull();
  });

  it("retains the intent on recoverable failure", async () => {
    setPostAuthIntent({ kind: "like_work", payload: { workId: "w1" }, returnTo: "/works/w1" });
    await expect(
      consumePostAuthIntent("me", async () => {
        throw new Error("network");
      }),
    ).rejects.toThrow("network");
    expect(peekPostAuthIntent()?.kind).toBe("like_work");
  });

  it("clears on explicit sign-out", () => {
    setPostAuthIntent({ kind: "return_to", returnTo: "/groups" });
    clearPostAuthIntent();
    expect(peekPostAuthIntent()).toBeNull();
  });

  it("does not run when there is nothing stored", async () => {
    const run = vi.fn();
    expect(await consumePostAuthIntent("me", run)).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it("migrates a legacy group seed link", () => {
    sessionStorage.setItem("ws.pendingGroupJoin", JSON.stringify({ token: "t1", slug: "chicago" }));
    migrateLegacyIntents();
    const intent = peekPostAuthIntent();
    expect(intent?.kind).toBe("group_seed_join");
    expect(intent?.payload.token).toBe("t1");
    expect(intent?.returnTo).toBe("/g/chicago");
    expect(sessionStorage.getItem("ws.pendingGroupJoin")).toBeNull();
  });

  it("migrates a legacy pending rsvp", () => {
    sessionStorage.setItem(
      "workshop:pending_rsvp",
      JSON.stringify({ event_id: "e9", status: "going", redirect_to: "/e/e9" }),
    );
    migrateLegacyIntents();
    const intent = peekPostAuthIntent();
    expect(intent?.kind).toBe("event_rsvp");
    expect(intent?.payload.event_id).toBe("e9");
  });

  it("does not clobber a current intent when migrating", () => {
    setPostAuthIntent({ kind: "return_to", returnTo: "/groups" });
    sessionStorage.setItem("ws.pendingGroupJoin", JSON.stringify({ token: "t", slug: "s" }));
    migrateLegacyIntents();
    expect(peekPostAuthIntent()?.kind).toBe("return_to");
  });
});
