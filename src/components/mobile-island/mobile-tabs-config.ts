import { Users, Sparkles, Briefcase, Megaphone, BookOpen, type LucideIcon } from "lucide-react";

export type MobileTabSide = "left" | "right";

export type MobileTab = {
  id: "gallery" | "collabs" | "groups" | "you";
  label: string;
  to: string;
  icon: LucideIcon | null; // null for "you" → renders avatar
  side: MobileTabSide;
};

/**
 * Groups own the live layer now, so the island leads with Groups instead of a
 * standalone Lounge tab. Gallery takes the freed right-hand slot; the four-slot
 * layout (two per side, composer in the middle) is unchanged.
 */
export const mobileTabs: readonly MobileTab[] = [
  { id: "groups", label: "Groups", to: "/groups", icon: Sparkles, side: "left" },
  { id: "collabs", label: "Collabs", to: "/collab", icon: Users, side: "left" },
  { id: "gallery", label: "Gallery", to: "/gallery", icon: Briefcase, side: "right" },
  { id: "you", label: "You", to: "/me", icon: null, side: "right" },
] as const;

export type MobileCreateAction = {
  id: "work" | "collab" | "blog";
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
};

export const mobileCreateActions: readonly MobileCreateAction[] = [
  {
    id: "work",
    label: "Post to Gallery",
    description: "Add a Work to your portfolio",
    to: "/works/new",
    icon: Briefcase,
  },
  {
    id: "collab",
    label: "Post a Collab",
    description: "Find people to make something",
    to: "/collab/new",
    icon: Megaphone,
  },
  {
    id: "blog",
    label: "Write a blog post",
    description: "Share process, notes, or essays",
    to: "/me/blog",
    icon: BookOpen,
  },
] as const;
