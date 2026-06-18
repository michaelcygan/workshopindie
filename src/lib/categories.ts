export type Category =
  | "film"
  | "music"
  | "writing"
  | "build"
  | "visual"
  | "critique"
  | "business"
  | "coworking"
  | "office_hours"
  | "roundtable"
  | "pitch"
  | "listen_party"
  | "open_mic"
  | "jam"
  | "standup";

/** Categories that can be published as a Work (excludes discussion-style topics). */
export const WORK_CATEGORY_IDS = ["film", "music", "writing", "build", "visual"] as const;
export type WorkCategory = (typeof WORK_CATEGORY_IDS)[number];

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "film", label: "Film" },
  { id: "music", label: "Music" },
  { id: "writing", label: "Writing" },
  { id: "build", label: "Build" },
  { id: "visual", label: "Visual" },
  { id: "critique", label: "Critique" },
  { id: "business", label: "Business of Art" },
  { id: "coworking", label: "Co-working" },
  { id: "office_hours", label: "Office Hours" },
  { id: "roundtable", label: "Roundtable" },
  { id: "pitch", label: "Pitch" },
  { id: "listen_party", label: "Listen Party" },
  { id: "open_mic", label: "Open Mic" },
  { id: "jam", label: "Jam" },
  { id: "standup", label: "Stand-up" },
];

export const WORK_CATEGORIES = CATEGORIES.filter((c) =>
  (WORK_CATEGORY_IDS as readonly string[]).includes(c.id),
);

export const SOURCE_LABELS: Record<string, string> = {
  workshop: "Workshop",
  collab_board: "Collab",
  meetup: "Meetup",
  instant: "Instant",
  manual: "Portfolio",
};

export const categoryClass = (c: Category) =>
  ({
    film: "bg-cat-film text-cat-film-ink",
    music: "bg-cat-music text-cat-music-ink",
    writing: "bg-cat-writing text-cat-writing-ink",
    build: "bg-cat-build text-cat-build-ink",
    visual: "bg-cat-visual text-cat-visual-ink",
    critique: "bg-cat-critique text-cat-critique-ink",
    business: "bg-cat-business text-cat-business-ink",
    coworking: "bg-cat-coworking text-cat-coworking-ink",
    office_hours: "bg-cat-office-hours text-cat-office-hours-ink",
    roundtable: "bg-cat-roundtable text-cat-roundtable-ink",
    pitch: "bg-cat-pitch text-cat-pitch-ink",
    listen_party: "bg-cat-listen-party text-cat-listen-party-ink",
    open_mic: "bg-cat-open-mic text-cat-open-mic-ink",
    jam: "bg-cat-jam text-cat-jam-ink",
    standup: "bg-cat-standup text-cat-standup-ink",
  })[c];
