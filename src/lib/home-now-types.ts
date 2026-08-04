/**
 * Client-safe types for the desktop "Now" board — the three-lane departures
 * board on the logged-in homepage. No server imports live here.
 */

export type HomeNowLane = "live" | "make" | "explore";

/** Where a board row came from — drives the small trailing source label. */
export type HomeNowSource =
  | "today"
  | "audio"
  | "event"
  | "continue"
  | "group"
  | "city"
  | "medium"
  | "network"
  | "evergreen";

/**
 * An allowlisted creation action. Nothing is created on rotation — only when
 * the member explicitly clicks the row.
 */
export type HomeNowAction =
  | { kind: "blog-prompt"; seedPromptId: string }
  | { kind: "collab-prompt"; prompt: string; groupSlug?: string };

/** A single rotating row on the board. */
export type HomeNowItem = {
  /** Stable id — used for dedupe, cooldown, and animation keys. */
  id: string;
  lane: HomeNowLane;
  source: HomeNowSource;
  /** Short uppercase status word, e.g. "TODAY", "AUDIO", "TONIGHT". */
  status: string;
  /** One-line headline, Archivo, clamped to a single line on the board. */
  title: string;
  /** Supporting line, Inter, clamped to a single line. */
  detail: string | null;
  /** Only true when the underlying activity is genuinely happening now. */
  isLive?: boolean;
  /** Navigation target (TanStack route path), when the row is a link. */
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, string | number | boolean>;
  /** Prompted creation, when the row is an action rather than a link. */
  action?: HomeNowAction;
  /** Higher weight surfaces earlier in the rotation. */
  weight: number;
};

export type HomeNowBoard = Record<HomeNowLane, HomeNowItem[]>;

export const HOME_NOW_LANES: ReadonlyArray<{ lane: HomeNowLane; label: string }> = [
  { lane: "live", label: "LIVE" },
  { lane: "make", label: "MAKE" },
  { lane: "explore", label: "EXPLORE" },
];
