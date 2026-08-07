import { describe, expect, it } from "vitest";
import {
  COME_ONLINE_THRESHOLD_MS,
  HEARTBEAT_INTERVAL_MS,
  ONLINE_WINDOW_MS,
  isComingOnline,
  isOnline,
} from "./policy";

const NOW = Date.UTC(2026, 7, 7, 12, 0, 0);
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("presence policy", () => {
  it("keeps the online window wider than one heartbeat", () => {
    expect(ONLINE_WINDOW_MS).toBeGreaterThan(HEARTBEAT_INTERVAL_MS);
  });

  describe("isOnline", () => {
    it("counts a fresh beat as online", () => {
      expect(isOnline(ago(5_000), NOW)).toBe(true);
    });

    it("survives a single dropped beat", () => {
      expect(isOnline(ago(HEARTBEAT_INTERVAL_MS + 1_000), NOW)).toBe(true);
    });

    it("goes offline past the window", () => {
      expect(isOnline(ago(ONLINE_WINDOW_MS + 1_000), NOW)).toBe(false);
    });

    it("treats missing or unparseable stamps as offline", () => {
      expect(isOnline(null, NOW)).toBe(false);
      expect(isOnline(undefined, NOW)).toBe(false);
      expect(isOnline("not a date", NOW)).toBe(false);
    });
  });

  describe("isComingOnline", () => {
    it("is true when never seen before", () => {
      expect(isComingOnline(null, NOW)).toBe(true);
    });

    it("is false during a normal per-minute heartbeat", () => {
      expect(isComingOnline(ago(HEARTBEAT_INTERVAL_MS), NOW)).toBe(false);
    });

    it("is true only after a real absence", () => {
      expect(isComingOnline(ago(COME_ONLINE_THRESHOLD_MS - 1_000), NOW)).toBe(false);
      expect(isComingOnline(ago(COME_ONLINE_THRESHOLD_MS + 1_000), NOW)).toBe(true);
    });
  });
});
