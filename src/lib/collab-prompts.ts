/**
 * Allowlisted Collab starter prompts used by the desktop "Now" board. The
 * composer prefills empty fields from these on first mount; nothing is
 * created until the member submits the form themselves.
 */

import type { WorkCategory } from "./categories";

export const COLLAB_PROMPT_IDS = [
  "weekend-short-film",
  "one-night-remix",
  "portfolio-feedback-swap",
  "table-read",
  "photo-walk",
] as const;

export type CollabPromptId = (typeof COLLAB_PROMPT_IDS)[number];

export const COLLAB_PROMPTS: Record<
  CollabPromptId,
  { title: string; description: string; category: WorkCategory }
> = {
  "weekend-short-film": {
    title: "Weekend short film — looking for a small crew",
    description:
      "A short shoot over one weekend. Small crew, simple setup, finished cut afterwards. Tell me what you'd want to do on it.",
    category: "film",
  },
  "one-night-remix": {
    title: "One-night remix swap",
    description:
      "Send me a stem or a track, I'll send you one back. One evening, no pressure, both of us end up with something new.",
    category: "music",
  },
  "portfolio-feedback-swap": {
    title: "Portfolio feedback swap",
    description:
      "You look at mine properly, I look at yours properly. Written notes, honest, within a week.",
    category: "visual",
  },
  "table-read": {
    title: "Table read for a draft",
    description:
      "Looking for readers for a draft script. An hour or two, out loud, then a short conversation about what landed.",
    category: "writing",
  },
  "photo-walk": {
    title: "Photo walk",
    description:
      "A few hours walking and shooting together. Any camera, any level. We share the results afterwards.",
    category: "visual",
  },
};
