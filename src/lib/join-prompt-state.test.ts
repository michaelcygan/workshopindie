import { describe, expect, it } from "vitest";
import {
  isJoinPromptSuppressedPath,
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

describe("isJoinPromptSuppressedPath", () => {
  it("suppresses auth and acquisition surfaces", () => {
    for (const p of ["/login", "/signup", "/reset-password", "/auth/complete", "/start-a-collab", "/checkout/return"]) {
      expect(isJoinPromptSuppressedPath(p)).toBe(true);
    }
  });

  it("allows content surfaces", () => {
    for (const p of ["/", "/blog", "/blog/some-post", "/groups", "/events"]) {
      expect(isJoinPromptSuppressedPath(p)).toBe(false);
    }
  });
});
