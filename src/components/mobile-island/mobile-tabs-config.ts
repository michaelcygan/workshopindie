import {
  Users,
  Sparkles,
  Briefcase,
  Megaphone,
  BookOpen,
  LayoutGrid,
  Calendar,
  type LucideIcon,
} from "lucide-react";

export type MobileTabSide = "left" | "right";

export type MobileTab = {
  id: "gallery" | "collabs" | "groups" | "events" | "blog" | "you";
  label: string;
  to: string;
  icon: LucideIcon | null; // null for "you" → renders avatar
  side: MobileTabSide;
};

/**
 * Six icon-only slots (three per side) with the composer in the middle, so
 * every main flow — Groups, Collabs, Gallery, Events, Blog, You — is one tap
 * away from anywhere on mobile.
 */
export const mobileTabs: readonly MobileTab[] = [
  { id: "groups", label: "Groups", to: "/groups", icon: Sparkles, side: "left" },
  { id: "collabs", label: "Collabs", to: "/collab", icon: Users, side: "left" },
  { id: "gallery", label: "Gallery", to: "/gallery", icon: LayoutGrid, side: "left" },
  { id: "events", label: "Events", to: "/events", icon: Calendar, side: "right" },
  { id: "blog", label: "Blog", to: "/blog", icon: BookOpen, side: "right" },
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
    id: "blog",
    label: "Write a blog post",
    description: "Share process, notes, or essays",
    to: "/me/blog",
    icon: BookOpen,
  },
  {
    id: "collab",
    label: "Post a Collab",
    description: "Find people to make something",
    to: "/collab/new",
    icon: Megaphone,
  },
  {
    id: "work",
    label: "Post to Gallery",
    description: "Add a Work to your portfolio",
    to: "/works/new",
    icon: Briefcase,
  },
] as const;
