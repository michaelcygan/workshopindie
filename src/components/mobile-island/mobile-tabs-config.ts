import { Radio, Users, Sparkles, Briefcase, Megaphone, BookOpen, type LucideIcon } from "lucide-react";

export type MobileTabSide = "left" | "right";

export type MobileTab = {
  id: "lounge" | "collabs" | "groups" | "you";
  label: string;
  to: string;
  icon: LucideIcon | null; // null for "you" → renders avatar
  side: MobileTabSide;
};

export const mobileTabs: readonly MobileTab[] = [
  { id: "lounge",  label: "Lounge",  to: "/lounge", icon: Radio,    side: "left"  },
  { id: "collabs", label: "Collabs", to: "/collab", icon: Users,    side: "left"  },
  { id: "groups",  label: "Groups",  to: "/groups", icon: Sparkles, side: "right" },
  { id: "you",     label: "You",     to: "/me",     icon: null,     side: "right" },
] as const;

export type MobileCreateAction = {
  id: "work" | "collab" | "blog";
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
};

export const mobileCreateActions: readonly MobileCreateAction[] = [
  { id: "work",   label: "Post to Gallery",   description: "Add a Work to your portfolio",    to: "/works/new", icon: Briefcase },
  { id: "collab", label: "Post a Collab",     description: "Find people to make something",   to: "/collab/new", icon: Megaphone },
  { id: "blog",   label: "Write a blog post", description: "Share process, notes, or essays", to: "/me/blog",    icon: BookOpen  },
] as const;
