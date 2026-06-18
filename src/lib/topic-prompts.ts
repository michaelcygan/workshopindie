import type { Category } from "@/lib/categories";

export const TOPIC_DESCRIPTIONS: Record<Category, string> = {
  film: "Writers' rooms, edit jams, dailies critique.",
  music: "Beat cooks, vocal sessions, mix feedback.",
  writing: "Co-writing sprints, prose critique, lyric labs.",
  build: "Pair-program, hackathons, design reviews.",
  visual: "Figure drawing, photo critique, illustration jams.",
  critique: "Drop a Work, get five sharp minds on it.",
  business: "Pricing, deals, distribution, taxes — bring questions.",
  coworking: "Cameras on, mics off. Get work done with company.",
  office_hours: "Drop in, ask the host one specific question, leave.",
  roundtable: "Topic-led discussion — bring an opinion.",
  pitch: "Practice a pitch or logline and get reactions.",
  listen_party: "Share finished work; everyone reacts together.",
  open_mic: "Take turns performing — comedy, music, poetry.",
  jam: "No goal, just make something with whoever shows up.",
  standup: "Quick check-in: what you're on, what's blocking you.",
};

/** Sub-mediums shown when picking under Critique / Co-working. */
export const SUB_MEDIUMS: { id: Category; label: string }[] = [
  { id: "film", label: "Film" },
  { id: "music", label: "Music" },
  { id: "writing", label: "Writing" },
  { id: "build", label: "Build" },
  { id: "visual", label: "Visual" },
];

export type PromptWeight = "obvious" | "wild";
export type RoomPrompt = {
  title: string;
  medium: Category | null;
  weight: PromptWeight;
};

/**
 * ~60 prompts across mediums, roughly 65% obvious / 35% wild.
 * Obvious = something anyone in that medium would join without thinking.
 * Wild = specific, time-bound, or weirdly-shaped — the ones that sell the platform.
 */
export const ROOM_PROMPTS: RoomPrompt[] = [
  // ── Film (8) ──
  { title: "Edit jam — bring 90 sec of footage", medium: "film", weight: "obvious" },
  { title: "Short film writers' room", medium: "film", weight: "obvious" },
  { title: "Dailies critique", medium: "film", weight: "obvious" },
  { title: "Music video treatment swap", medium: "film", weight: "obvious" },
  { title: "Color grade my opening shot", medium: "film", weight: "obvious" },
  { title: "Pitch your doc in 3 minutes", medium: "film", weight: "wild" },
  { title: "Storyboard speedrun, 30 min", medium: "film", weight: "wild" },
  { title: "One scene, five rewrites", medium: "film", weight: "wild" },

  // ── Music (8) ──
  { title: "Mix feedback — bring stems", medium: "music", weight: "obvious" },
  { title: "Beat cook-off", medium: "music", weight: "obvious" },
  { title: "Songwriting session", medium: "music", weight: "obvious" },
  { title: "Vocal recording feedback", medium: "music", weight: "obvious" },
  { title: "Mastering Q&A", medium: "music", weight: "obvious" },
  { title: "1 hyperpop song an hour, all day", medium: "music", weight: "wild" },
  { title: "Need a vocalist for a tech house track", medium: "music", weight: "wild" },
  { title: "Trap bootcamp, one hour", medium: "music", weight: "wild" },

  // ── Writing (8) ──
  { title: "Co-writing sprint", medium: "writing", weight: "obvious" },
  { title: "Short story critique", medium: "writing", weight: "obvious" },
  { title: "Screenplay table read", medium: "writing", weight: "obvious" },
  { title: "Poetry round-robin", medium: "writing", weight: "obvious" },
  { title: "Edit my first chapter", medium: "writing", weight: "obvious" },
  { title: "Query letter teardown", medium: "writing", weight: "obvious" },
  { title: "Write a flash story in 20 min", medium: "writing", weight: "wild" },
  { title: "Anonymous opening lines, vote the winner", medium: "writing", weight: "wild" },

  // ── Build (8) ──
  { title: "Pair-program on a bug", medium: "build", weight: "obvious" },
  { title: "Design review my landing page", medium: "build", weight: "obvious" },
  { title: "Code review, BYO PR", medium: "build", weight: "obvious" },
  { title: "Ship a feature in an hour", medium: "build", weight: "obvious" },
  { title: "Solo founder accountability", medium: "build", weight: "obvious" },
  { title: "Mental health hackathon", medium: "build", weight: "wild" },
  { title: "Build-in-public, cameras on", medium: "build", weight: "wild" },
  { title: "Rewrite one function five ways", medium: "build", weight: "wild" },

  // ── Visual (8) ──
  { title: "Portfolio review", medium: "visual", weight: "obvious" },
  { title: "Photo critique, 5 shots each", medium: "visual", weight: "obvious" },
  { title: "Figure drawing from references", medium: "visual", weight: "obvious" },
  { title: "Illustration jam", medium: "visual", weight: "obvious" },
  { title: "Logo crit, no egos", medium: "visual", weight: "obvious" },
  { title: "Color study hour", medium: "visual", weight: "obvious" },
  { title: "Same prompt, 30 min, compare", medium: "visual", weight: "wild" },
  { title: "Concept art for a fake game", medium: "visual", weight: "wild" },

  // ── Critique (5) ──
  { title: "Bring one Work, leave with a list", medium: "critique", weight: "obvious" },
  { title: "Rapid portfolio review", medium: "critique", weight: "obvious" },
  { title: "Pitch your loglines", medium: "critique", weight: "obvious" },
  { title: "Honest opinions only", medium: "critique", weight: "wild" },
  { title: "5 sharp minds, 10 min each", medium: "critique", weight: "wild" },

  // ── Business (6) ──
  { title: "Pricing your first commission", medium: "business", weight: "obvious" },
  { title: "Contract review, BYO doc", medium: "business", weight: "obvious" },
  { title: "Cold email teardown", medium: "business", weight: "obvious" },
  { title: "Taxes for freelancers, Q&A", medium: "business", weight: "obvious" },
  { title: "How I got my first $1k", medium: "business", weight: "wild" },
  { title: "Negotiate my rate, role-play", medium: "business", weight: "wild" },

  // ── Co-working (6) ──
  { title: "Cameras on, mics off — 2 hours", medium: "coworking", weight: "obvious" },
  { title: "Heads-down work session", medium: "coworking", weight: "obvious" },
  { title: "Morning pages, then deep work", medium: "coworking", weight: "obvious" },
  { title: "Sunday plan-the-week", medium: "coworking", weight: "obvious" },
  { title: "Late-night ship sprint", medium: "coworking", weight: "wild" },
  { title: "Pomodoro × 4, then show & tell", medium: "coworking", weight: "wild" },
];

/** Fisher-Yates shuffle, returns a new array. */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Deal prompts into N rows so each row has a similar mix of "obvious" vs "wild"
 * and no row is dominated by one medium. Returns N arrays of length ~perRow.
 */
export function dealPromptRows(
  pool: readonly RoomPrompt[],
  rows: number,
  perRow: number,
): RoomPrompt[][] {
  const obvious = shuffle(pool.filter((p) => p.weight === "obvious"));
  const wild = shuffle(pool.filter((p) => p.weight === "wild"));
  const out: RoomPrompt[][] = Array.from({ length: rows }, () => []);

  // Round-robin each bucket so each row receives the same ratio.
  obvious.forEach((p, i) => out[i % rows].push(p));
  wild.forEach((p, i) => out[i % rows].push(p));

  // Trim/refill each row to exactly perRow, and shuffle within row so the
  // obvious/wild items aren't clumped at the end.
  return out.map((row) => {
    const r = shuffle(row).slice(0, perRow);
    if (r.length < perRow) {
      // Refill from the wider pool if a medium was thin.
      const extras = shuffle(pool).filter((p) => !r.includes(p));
      r.push(...extras.slice(0, perRow - r.length));
    }
    return r;
  });
}
