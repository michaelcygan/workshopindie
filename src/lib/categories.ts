export type Category =
  | "film"
  | "music"
  | "writing"
  | "build"
  | "visual"
  | "critique"
  | "business"
  | "mentorship";

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "film", label: "Film" },
  { id: "music", label: "Music" },
  { id: "writing", label: "Writing" },
  { id: "build", label: "Build" },
  { id: "visual", label: "Visual" },
  { id: "critique", label: "Critique" },
  { id: "business", label: "Business of Art" },
  { id: "mentorship", label: "Mentorship" },
];

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
    mentorship: "bg-cat-mentorship text-cat-mentorship-ink",
  })[c];
