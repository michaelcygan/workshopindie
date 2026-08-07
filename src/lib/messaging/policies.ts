/**
 * One declared policy per messaging surface.
 *
 * Every place a person can type a message used to re-decide its own limits,
 * rate limit, link rules and moderation surface. Those decisions now live
 * here as data, so drift between surfaces is visible in one file instead of
 * hiding in five handlers. Values below are exactly what each surface
 * enforced before this consolidation — nothing tightened, nothing relaxed.
 */

import type { SpamOpts } from "@/lib/moderation/engine";

export type MessageSurface = "dm" | "room" | "today" | "collab" | "system";

export type MessagePolicy = {
  /** Max characters after trimming. */
  maxLength: number;
  /** Reject known-bad domains (adult / extremist hubs) in the body. */
  blockedLinks: { enabled: boolean; message: string };
  /**
   * Per-user throttle via the `check_and_bump` RPC, or null when the surface
   * relies on a database-side trigger instead.
   */
  rateLimit: { action: string; windowS: number; max: number } | null;
  /** Community-standards check, or null for system-authored text. */
  moderation: { surface: string; spam?: SpamOpts } | null;
};

export const MESSAGE_POLICIES: Record<MessageSurface, MessagePolicy> = {
  // Direct messages. Blocks between the two people are enforced by the
  // `can_dm(...)` check inside the insert policy on `messages`.
  dm: {
    maxLength: 2000,
    blockedLinks: { enabled: false, message: "That link isn't allowed here." },
    rateLimit: { action: "dm_send", windowS: 60, max: 30 },
    moderation: {
      surface: "dm.message",
      spam: { maxLinks: 5, maxRepeatChars: 30 },
    },
  },

  // Live room chat. Room membership is enforced by RLS on `instant_messages`.
  room: {
    maxLength: 1000,
    blockedLinks: { enabled: true, message: "That link isn't allowed in Lounge." },
    rateLimit: null,
    moderation: {
      surface: "instant.message",
      spam: { maxLinks: 5, maxRepeatChars: 30 },
    },
  },

  // Group Today posts. Expiry and rate limiting are trigger-side.
  today: {
    maxLength: 500,
    blockedLinks: { enabled: false, message: "That link isn't allowed here." },
    rateLimit: null,
    moderation: {
      surface: "group.today",
      spam: { maxLinks: 4, maxRepeatChars: 25 },
    },
  },

  // Collab workspace messages. Membership is enforced by RLS.
  collab: {
    maxLength: 2000,
    blockedLinks: { enabled: true, message: "That link isn't allowed here." },
    rateLimit: null,
    moderation: { surface: "collab_messages" },
  },

  // System-authored text (seeded intros). Already moderated where it was
  // typed; it still gets normalization and length checks, never a throttle.
  system: {
    maxLength: 4000,
    blockedLinks: { enabled: false, message: "That link isn't allowed here." },
    rateLimit: null,
    moderation: null,
  },
};
