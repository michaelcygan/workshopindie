/**
 * One authoritative place for Workshop's root username namespace.
 *
 * A username is a claim on `workshopindie.com/{username}`, so it must never
 * collide with a Workshop route. Client code uses this for friendly, instant
 * validation; the database trigger `public.enforce_username_namespace` is the
 * authoritative enforcement layer.
 */

export const SITE_ORIGIN = "https://workshopindie.com";

/** Root-level route segments that exist today. Keep in sync with src/routes/. */
export const ROUTE_RESERVED = [
  "admin",
  "api",
  "auth",
  "blog",
  "checkout",
  "cities",
  "claim",
  "collab",
  "dms",
  "e",
  "events",
  "forgot-password",
  "g",
  "gallery",
  "goodbye",
  "groups",
  "index",
  "login",
  "lounge",
  "mcp",
  "me",
  "onboarding",
  "pricing",
  "redeem",
  "refer",
  "reset-password",
  "settings",
  "signup",
  "sitemap",
  "sitemap.xml",
  "u",
  "w",
  "works",
  "workshops",
] as const;

/** Words we want to keep available for future Workshop surfaces. */
export const FUTURE_RESERVED = [
  "about",
  "account",
  "careers",
  "contact",
  "discover",
  "explore",
  "feed",
  "help",
  "home",
  "legal",
  "messages",
  "notifications",
  "press",
  "privacy",
  "profile",
  "search",
  "security",
  "shop",
  "static",
  "store",
  "support",
  "terms",
  "workshop",
  "workshopindie",
  "robots.txt",
  "favicon.ico",
  "llms.txt",
] as const;

export const RESERVED_USERNAMES: ReadonlySet<string> = new Set<string>([
  ...ROUTE_RESERVED,
  ...FUTURE_RESERVED,
]);

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 30;

/** Lowercase and strip anything that isn't a-z, 0-9, hyphen or underscore. */
export function normalizeUsername(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, USERNAME_MAX);
}

export type UsernameProblem = "too_short" | "too_long" | "invalid" | "reserved";

export type UsernameCheck =
  | { ok: true; username: string }
  | { ok: false; problem: UsernameProblem; message: string };

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has((username || "").toLowerCase());
}

/** Single source of truth for "is this handle allowed?". */
export function validateUsername(raw: string): UsernameCheck {
  const username = (raw || "").toLowerCase().trim();
  if (username.length < USERNAME_MIN) {
    return { ok: false, problem: "too_short", message: "Usernames need at least 2 characters." };
  }
  if (username.length > USERNAME_MAX) {
    return { ok: false, problem: "too_long", message: "Usernames can be up to 30 characters." };
  }
  if (!/^[a-z0-9_-]+$/.test(username)) {
    return {
      ok: false,
      problem: "invalid",
      message: "Use lowercase letters, numbers, hyphens or underscores only.",
    };
  }
  if (isReservedUsername(username)) {
    return { ok: false, problem: "reserved", message: "That username is reserved by Workshop." };
  }
  return { ok: true, username };
}

/** Canonical in-app path for a creator profile. */
export function profilePath(username: string): string {
  return `/${username}`;
}

/** Canonical absolute URL for a creator profile. */
export function profileUrl(username: string): string {
  return `${SITE_ORIGIN}/${username}`;
}

/**
 * True when a pathname is a canonical root profile URL (`/username`), i.e. a
 * single segment that isn't a reserved Workshop route word.
 */
export function isProfilePath(pathname: string): boolean {
  const seg = (pathname || "").replace(/^\/+|\/+$/g, "");
  if (!seg || seg.includes("/")) return false;
  return validateUsername(decodeURIComponent(seg)).ok;
}
