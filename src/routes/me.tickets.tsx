import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidated into /events?mine=true. Kept as a redirect for old links / bookmarks.
export const Route = createFileRoute("/me/tickets")({
  beforeLoad: () => {
    throw redirect({ to: "/events", search: { mine: true } });
  },
  component: () => null,
});
