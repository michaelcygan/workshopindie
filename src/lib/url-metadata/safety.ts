/**
 * Server-side URL safety for any feature that resolves remote metadata
 * (Post a Work, Add an Influence). Deterministic, no network calls, no AI.
 *
 * Two independent gates:
 *  1. Transport safety — only http(s), never localhost / loopback / private /
 *     link-local / internal destinations. Re-checked on every redirect hop.
 *  2. Content safety — the curated adult/extremist host blocklist already used
 *     by Lounge chat. Applied *before* any fetch so blocked hosts are never
 *     contacted.
 */
import { isBlockedUrl } from "@/lib/moderation/url-blocklist";

export type UrlSafetyReason = "invalid" | "scheme" | "private" | "blocked";

export type UrlSafetyResult =
  | { ok: true; url: URL }
  | { ok: false; reason: UrlSafetyReason };

const PRIVATE_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return true;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!h.includes(":")) return false;
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fe80") || h.startsWith("fc") || h.startsWith("fd")) return true;
  const mapped = h.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped && isPrivateIPv4(mapped[1])) return true;
  return false;
}

/** True when the hostname points somewhere we must never fetch from the server. */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (PRIVATE_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return true;
  if (!h.includes(".") && !h.includes(":")) return true; // bare hostnames = intranet
  if (isPrivateIPv4(h)) return true;
  if (isPrivateIPv6(h)) return true;
  return false;
}

/** Validate a URL for server-side fetching. Never throws. */
export function checkUrlSafety(raw: string): UrlSafetyResult {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, reason: "scheme" };
  if (u.username || u.password) return { ok: false, reason: "private" };
  if (isPrivateHost(u.hostname)) return { ok: false, reason: "private" };
  if (isBlockedUrl(u.toString())) return { ok: false, reason: "blocked" };
  return { ok: true, url: u };
}

export function safetyMessage(reason: UrlSafetyReason): string {
  switch (reason) {
    case "blocked":
      return "That site isn't allowed on Workshop.";
    case "private":
      return "That address can't be reached.";
    case "scheme":
      return "Only http and https links are supported.";
    default:
      return "That doesn't look like a valid link.";
  }
}

/** Only allow https images we render on profiles; anything else falls back. */
export function safeImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (isPrivateHost(u.hostname)) return null;
    if (u.toString().length > 2000) return null;
    return u.toString();
  } catch {
    return null;
  }
}
