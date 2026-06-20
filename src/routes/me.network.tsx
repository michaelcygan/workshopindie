import { createFileRoute, redirect } from "@tanstack/react-router";

// Canonical URL for the network page. Mirrors /me/friends so existing
// bookmarks keep working while new nav links point here.
export const Route = createFileRoute("/me/network")({
  beforeLoad: () => {
    throw redirect({ to: "/me/friends" });
  },
});
