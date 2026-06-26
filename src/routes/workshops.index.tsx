import { createFileRoute, redirect } from "@tanstack/react-router";

// /workshops/* has been retired in the Lounge rebrand.
// The standing surface for scheduled IRL/online gatherings is /events.
export const Route = createFileRoute("/workshops/")({
  beforeLoad: () => {
    throw redirect({ to: "/events", replace: true });
  },
  component: () => null,
});
