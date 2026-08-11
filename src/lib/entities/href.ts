/**
 * Resolve an internal href back into a Workshop entity address.
 *
 * The inverse of `workshopEntityUrl`. Editorial surfaces (blog bodies, member
 * writing) store plain markdown links to Workshop pages; this lets any renderer
 * recognise those links and upgrade them to a preview without changing how the
 * link is authored or stored.
 *
 * Client-safe: no server imports.
 */
import type { WorkshopEntityAddress } from "@/lib/entities/kinds";
import { isReservedUsername } from "@/lib/usernames";

const SLUG = /^[a-zA-Z0-9._-]+$/;

/** Strip origin/query/hash and return the pathname, or null for external URLs. */
function internalPathname(href: string): string | null {
  const raw = (href || "").trim();
  if (!raw || raw.startsWith("#")) return null;
  if (/^(mailto|tel|javascript):/i.test(raw)) return null;
  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    const host = url.hostname.toLowerCase();
    const internalHost =
      host === "workshopindie.com" ||
      host === "www.workshopindie.com" ||
      host === "workshopindie.lovable.app" ||
      host === "localhost";
    if (!internalHost) return null;
    path = url.pathname;
  }
  if (!path.startsWith("/")) return null;
  return path.split("?")[0].split("#")[0];
}

/**
 * Map an href to the entity it points at, or null when it is external or not a
 * previewable Workshop page.
 */
export function parseWorkshopHref(href: string | undefined | null): WorkshopEntityAddress | null {
  if (!href) return null;
  const path = internalPathname(href);
  if (!path) return null;
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  const [a, b, c, d] = parts;

  if (a === "works" && b && parts.length === 2 && SLUG.test(b)) return { kind: "work", slug: b };
  if (a === "collab" && b && parts.length === 2 && SLUG.test(b)) return { kind: "collab", slug: b };
  if (a === "blog" && b && parts.length === 2 && b !== "c" && SLUG.test(b)) {
    return { kind: "post", slug: b };
  }
  if (a === "g" && b && SLUG.test(b)) {
    if (parts.length === 2) return { kind: "group", slug: b };
    if (parts.length === 4 && c === "e" && d && SLUG.test(d)) {
      return { kind: "event", slug: d, groupSlug: b };
    }
    return null;
  }
  if (parts.length === 1 && SLUG.test(a) && !isReservedUsername(a) && !a.includes(".")) {
    return { kind: "profile", username: a };
  }
  return null;
}
