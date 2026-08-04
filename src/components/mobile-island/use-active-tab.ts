import type { MobileTab } from "./mobile-tabs-config";

export function getActiveTabId(pathname: string): MobileTab["id"] | null {
  // "You" surfaces first so /me/blog doesn't light up the public Blog tab.
  if (
    pathname === "/me" ||
    pathname.startsWith("/me/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/dms" ||
    pathname.startsWith("/dms/") ||
    pathname === "/refer" ||
    pathname.startsWith("/refer/")
  )
    return "you";
  if (pathname === "/collab" || pathname.startsWith("/collab/")) return "collabs";
  if (pathname === "/gallery" || pathname.startsWith("/gallery/")) return "gallery";
  if (pathname === "/events" || pathname.startsWith("/events/") || pathname.startsWith("/e/"))
    return "events";
  if (pathname === "/blog" || pathname.startsWith("/blog/")) return "blog";
  if (pathname === "/groups" || pathname.startsWith("/groups/") || pathname.startsWith("/g/"))
    return "groups";
  return null;
}
