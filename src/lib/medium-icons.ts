import {
  Coffee,
  Clapperboard,
  Music,
  PenLine,
  Wrench,
  Palette,
  MessagesSquare,
  Briefcase,
  Mic2,
  Users,
  Presentation,
  Radio,
  type LucideIcon,
} from "lucide-react";

/** Picks a lucide icon for a Workshop medium / category. Default = Coffee (lounge). */
export function mediumIcon(medium: string | null | undefined): LucideIcon {
  const key = (medium ?? "").toLowerCase();
  switch (key) {
    case "film":
      return Clapperboard;
    case "music":
    case "listen_party":
    case "jam":
      return Music;
    case "writing":
      return PenLine;
    case "build":
      return Wrench;
    case "visual":
      return Palette;
    case "critique":
    case "roundtable":
      return MessagesSquare;
    case "business":
    case "office_hours":
      return Briefcase;
    case "open_mic":
      return Mic2;
    case "pitch":
      return Presentation;
    case "standup":
      return Users;
    case "coworking":
      return Coffee;
    default:
      return Radio;
  }
}
