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
};

/** Sub-mediums shown when picking under Critique / Co-working. */
export const SUB_MEDIUMS: { id: Category; label: string }[] = [
  { id: "film", label: "Film" },
  { id: "music", label: "Music" },
  { id: "writing", label: "Writing" },
  { id: "build", label: "Build" },
  { id: "visual", label: "Visual" },
];

export type RoomPrompt = { title: string; medium: Category | null };

export const ROOM_PROMPTS: RoomPrompt[] = [
  // Film
  { title: "Short film writers' room", medium: "film" },
  { title: "Dailies critique, bring 90 sec", medium: "film" },
  { title: "Edit jam: cut my opening", medium: "film" },
  { title: "Doc pitch polish", medium: "film" },
  { title: "Music video treatment swap", medium: "film" },
  { title: "Storyboard speedrun", medium: "film" },
  // Music
  { title: "1 hyperpop song an hour, all day", medium: "music" },
  { title: "Trap bootcamp, 1 hr", medium: "music" },
  { title: "Need a vocalist for a tech house song", medium: "music" },
  { title: "Beat cook-off, 5 producers", medium: "music" },
  { title: "Mix feedback, bring stems", medium: "music" },
  { title: "Lyric writing sprint", medium: "music" },
  // Writing
  { title: "6 hr co-writing sprint", medium: "writing" },
  { title: "Short story critique, 2k words max", medium: "writing" },
  { title: "Poetry round-robin", medium: "writing" },
  { title: "Screenplay table read", medium: "writing" },
  { title: "Cold-open writers' room", medium: "writing" },
  { title: "Newsletter editing swap", medium: "writing" },
  // Build
  { title: "Mental health hackathon", medium: "build" },
  { title: "Ship-a-feature-in-an-hour", medium: "build" },
  { title: "Design review: my landing page", medium: "build" },
  { title: "Pair on a weird bug", medium: "build" },
  { title: "Build-in-public co-working", medium: "build" },
  { title: "Solo founder accountability", medium: "build" },
  // Visual
  { title: "Figure drawing from references", medium: "visual" },
  { title: "Photo critique, 5 shots each", medium: "visual" },
  { title: "Illustration jam: same prompt, 30 min", medium: "visual" },
  { title: "Concept art swap", medium: "visual" },
  { title: "Type-design crit", medium: "visual" },
  { title: "Color study hour", medium: "visual" },
  // Critique
  { title: "Bring one Work, leave with a list", medium: "critique" },
  { title: "Pitch your loglines", medium: "critique" },
  { title: "Rapid portfolio review", medium: "critique" },
  { title: "Honest opinions only", medium: "critique" },
  // Business
  { title: "Pricing your first commission", medium: "business" },
  { title: "Cold email teardown", medium: "business" },
  { title: "Contract review, BYO doc", medium: "business" },
  { title: "How I got my first $1k", medium: "business" },
  // Co-working
  { title: "Cameras on, mics off, 2 hours", medium: "coworking" },
  { title: "Morning pages, then heads-down", medium: "coworking" },
  { title: "Late-night ship sprint", medium: "coworking" },
  { title: "Sunday reset & plan the week", medium: "coworking" },
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
