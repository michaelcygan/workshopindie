import { describe, expect, it } from "vitest";
import {
  isJoinPromptAllowedPath,
  JOIN_PROMPT_SNOOZE_MS,
  shouldShowJoinPrompt,
  snoozeUntil,
} from "./join-prompt-state";

const NOW = 1_700_000_000_000;

describe("shouldShowJoinPrompt", () => {
  it("shows for a visitor who has never seen it", () => {
    expect(shouldShowJoinPrompt(NOW, null)).toBe(true);
  });

  it("hides inside the 7-day window", () => {
    const stored = String(snoozeUntil(NOW));
    expect(shouldShowJoinPrompt(NOW + 60_000, stored)).toBe(false);
    expect(shouldShowJoinPrompt(NOW + JOIN_PROMPT_SNOOZE_MS - 1, stored)).toBe(false);
  });

  it("shows again once the window lapses", () => {
    const stored = String(snoozeUntil(NOW));
    expect(shouldShowJoinPrompt(NOW + JOIN_PROMPT_SNOOZE_MS, stored)).toBe(true);
    expect(shouldShowJoinPrompt(NOW + JOIN_PROMPT_SNOOZE_MS + 1000, stored)).toBe(true);
  });

  it("treats garbage as never seen", () => {
    expect(shouldShowJoinPrompt(NOW, "not-a-number")).toBe(true);
  });
});

describe("isJoinPromptAllowedPath", () => {
  it("allows the homepage and Events surfaces", () => {
    for (const p of [
      "/",
      "/events",
      "/events/",
      "/events/remote",
      "/e/AB12CD",
      "/g/chicago-film/e/open-house-may",
    ]) {
      expect(isJoinPromptAllowedPath(p)).toBe(true);
    }
  });

  it("never advertises over profiles, works, or other content", () => {
    for (const p of [
      "/mikecygan",
      "/works/king-of-the-lake",
      "/blog",
      "/blog/some-post",
      "/groups",
      "/g/chicago-film",
      "/collab",
      "/topics/editing",
      "/gallery",
    ]) {
      expect(isJoinPromptAllowedPath(p)).toBe(false);
    }
  });

  it("stays off auth and acquisition surfaces", () => {
    for (const p of ["/login", "/signup", "/reset-password", "/auth/complete", "/start-a-collab", "/checkout/return"]) {
      expect(isJoinPromptAllowedPath(p)).toBe(false);
    }
  });
});
