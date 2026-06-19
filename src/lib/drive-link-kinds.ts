import {
  FileText,
  Sheet,
  Presentation,
  FolderOpen,
  Figma,
  StickyNote,
  Github,
  GitPullRequest,
  Code2,
  Youtube,
  Video,
  Box,
  HardDrive,
  Link as LinkIcon,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";

export type DriveLinkKind = {
  icon: LucideIcon;
  /** Short label like "Google · Doc" */
  label: string;
  /** Tailwind text class for the icon color */
  color: string;
  /** Tailwind bg class for the icon's circle */
  bg: string;
};

/** Derive an object kind (icon + label + color) from a Drive link URL. */
export function detectLinkKind(url: string): DriveLinkKind {
  let host = "";
  let path = "";
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, "");
    path = u.pathname;
  } catch {
    return { icon: LinkIcon, label: "Link", color: "text-ink-muted", bg: "bg-muted" };
  }

  // Google
  if (host === "docs.google.com") {
    if (path.startsWith("/document")) return { icon: FileText, label: "Google · Doc", color: "text-blue-600", bg: "bg-blue-500/10" };
    if (path.startsWith("/spreadsheets")) return { icon: Sheet, label: "Google · Sheet", color: "text-emerald-600", bg: "bg-emerald-500/10" };
    if (path.startsWith("/presentation")) return { icon: Presentation, label: "Google · Slides", color: "text-orange-600", bg: "bg-orange-500/10" };
    if (path.startsWith("/forms")) return { icon: FileText, label: "Google · Form", color: "text-violet-600", bg: "bg-violet-500/10" };
  }
  if (host === "drive.google.com") {
    return { icon: FolderOpen, label: "Google · Drive", color: "text-amber-600", bg: "bg-amber-500/10" };
  }

  // Figma
  if (host === "figma.com" || host.endsWith(".figma.com")) {
    if (path.includes("/board")) return { icon: Figma, label: "Figma · FigJam", color: "text-pink-600", bg: "bg-pink-500/10" };
    return { icon: Figma, label: "Figma", color: "text-fuchsia-600", bg: "bg-fuchsia-500/10" };
  }

  // Notion
  if (host === "notion.so" || host.endsWith(".notion.so") || host.endsWith(".notion.site")) {
    return { icon: StickyNote, label: "Notion", color: "text-ink", bg: "bg-ink/5" };
  }

  // Dropbox / Box
  if (host === "dropbox.com" || host.endsWith(".dropbox.com")) {
    return { icon: HardDrive, label: "Dropbox", color: "text-sky-600", bg: "bg-sky-500/10" };
  }
  if (host === "box.com" || host.endsWith(".box.com")) {
    return { icon: Box, label: "Box", color: "text-indigo-600", bg: "bg-indigo-500/10" };
  }

  // GitHub
  if (host === "github.com" || host.endsWith(".github.com")) {
    if (/\/pull\//.test(path)) return { icon: GitPullRequest, label: "GitHub · PR", color: "text-violet-600", bg: "bg-violet-500/10" };
    if (/\/blob\//.test(path) || /\/tree\//.test(path)) return { icon: Code2, label: "GitHub · Code", color: "text-ink", bg: "bg-ink/5" };
    return { icon: Github, label: "GitHub · Repo", color: "text-ink", bg: "bg-ink/5" };
  }

  // Video
  if (host === "youtube.com" || host === "youtu.be" || host.endsWith(".youtube.com")) {
    return { icon: Youtube, label: "YouTube", color: "text-red-600", bg: "bg-red-500/10" };
  }
  if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
    return { icon: Video, label: "Vimeo", color: "text-cyan-600", bg: "bg-cyan-500/10" };
  }
  if (host === "loom.com" || host.endsWith(".loom.com")) {
    return { icon: Video, label: "Loom", color: "text-violet-600", bg: "bg-violet-500/10" };
  }

  // Audio
  if (host === "soundcloud.com" || host.endsWith(".soundcloud.com")) {
    return { icon: Video, label: "SoundCloud", color: "text-orange-600", bg: "bg-orange-500/10" };
  }

  // Images
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(path)) {
    return { icon: ImageIcon, label: "Image", color: "text-emerald-600", bg: "bg-emerald-500/10" };
  }

  return { icon: LinkIcon, label: host || "Link", color: "text-ink-muted", bg: "bg-muted" };
}
