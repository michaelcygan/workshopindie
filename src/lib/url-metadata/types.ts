import type { Category } from "@/lib/categories";

export type Provider =
  | "youtube"
  | "vimeo"
  | "soundcloud"
  | "spotify"
  | "bandcamp"
  | "tiktok"
  | "instagram"
  | "twitter"
  | "github"
  | "behance"
  | "dribbble"
  | "arena"
  | "substack"
  | "medium"
  | "amazon"
  | "goodreads"
  | "bookshop"
  | "apple_books"
  | "google_books"
  | "generic";

export type BookBuyLink = { label: string; url: string };

export type ExtractedWork = {
  provider: Provider;
  title: string | null;
  description: string | null;
  cover_url: string | null;
  embed_url: string | null;
  primary_url: string;
  suggested_category: Category | null;
  author_name: string | null;
  /** Populated only when the link is recognized as a book source. */
  book?: {
    author: string | null;
    buy_links: BookBuyLink[];
  };
};

export const PROVIDER_LABELS: Record<Provider, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  soundcloud: "SoundCloud",
  spotify: "Spotify",
  bandcamp: "Bandcamp",
  tiktok: "TikTok",
  instagram: "Instagram",
  twitter: "X",
  github: "GitHub",
  behance: "Behance",
  dribbble: "Dribbble",
  arena: "Are.na",
  substack: "Substack",
  medium: "Medium",
  amazon: "Amazon",
  goodreads: "Goodreads",
  bookshop: "Bookshop",
  apple_books: "Apple Books",
  google_books: "Google Books",
  generic: "Website",
};

/** Human label for a stored provider string; falls back to the domain. */
export function providerLabel(provider: string | null, url?: string | null): string {
  if (provider && provider in PROVIDER_LABELS) {
    return PROVIDER_LABELS[provider as Provider];
  }
  if (url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
  }
  return "Website";
}
