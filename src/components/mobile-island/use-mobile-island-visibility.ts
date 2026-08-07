import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { isProfilePath } from "@/lib/usernames";

export type MobileIslandVisibility = {
  islandVisible: boolean;
  composerVisible: boolean;
};

const HIDDEN_ISLAND_EXACT = new Set([
  "/login",
  "/signup",
  "/onboarding",
  "/forgot-password",
  "/reset-password",
  "/checkout/return",
]);

function pathHidesIsland(pathname: string): boolean {
  if (HIDDEN_ISLAND_EXACT.has(pathname)) return true;
  // Individual lounge room (lounge dock owns bottom).
  if (/^\/lounge\/[^/]+/.test(pathname)) return true;
  if (pathname.startsWith("/oauth/")) return true;
  if (pathname.startsWith("/redeem/")) return true;
  if (pathname.startsWith("/auth/")) return true;
  // Blog editor: distraction-free writing surface (not the /me/blog dashboard).
  if (/^\/me\/blog\/[^/]+/.test(pathname)) return true;
  return false;
}

function pathHidesComposer(pathname: string): boolean {
  if (pathname === "/works/new") return true;
  if (/^\/works\/[^/]+\/edit$/.test(pathname)) return true;
  if (pathname === "/collab/new") return true;
  if (/^\/collab\/[^/]+\/edit$/.test(pathname)) return true;
  // Blog editor: /me/blog/:id but not /me/blog itself (dashboard).
  if (/^\/me\/blog\/[^/]+/.test(pathname)) return true;
  if (pathname.endsWith("/edit")) return true;
  return false;
}

export function useMobileIslandVisibility(): MobileIslandVisibility {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuth();

  // Never flash member chrome while auth is still resolving.
  if (loading) return { islandVisible: false, composerVisible: false };

  // The logged-out homepage is an editorial surface — no member chrome.
  if (!user && pathname === "/") {
    return { islandVisible: false, composerVisible: false };
  }

  // Preserve existing standalone behavior for logged-out visitors.
  if (!user && (isProfilePath(pathname) || pathname.startsWith("/works/"))) {
    return { islandVisible: false, composerVisible: false };
  }

  const islandVisible = !pathHidesIsland(pathname);
  const composerVisible = islandVisible && !pathHidesComposer(pathname);
  return { islandVisible, composerVisible };
}
