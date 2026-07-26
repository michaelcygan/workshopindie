import type { MobileTab } from "./mobile-tabs-config";

export function getActiveTabId(pathname: string): MobileTab["id"] | null {
  if (pathname === "/lounge" || pathname.startsWith("/lounge/")) return "lounge";
  if (pathname === "/collab" || pathname.startsWith("/collab/")) return "collabs";
  if (
    pathname === "/groups" ||
    pathname.startsWith("/groups/") ||
    pathname.startsWith("/g/")
  ) return "groups";
  if (
    pathname === "/me" ||
    pathname.startsWith("/me/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/dms" ||
    pathname.startsWith("/dms/") ||
    pathname === "/refer" ||
    pathname.startsWith("/refer/")
  ) return "you";
  return null;
}
