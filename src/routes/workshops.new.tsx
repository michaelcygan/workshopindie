import { createFileRoute, redirect } from "@tanstack/react-router";

// Creating a "Workshop" is no longer a first-class action.
// Live = Lounge (drop-in, no scheduling); Scheduled gatherings = Event.
export const Route = createFileRoute("/workshops/new")({
  beforeLoad: () => {
    throw redirect({ to: "/events/new", replace: true });
  },
  component: () => null,
});
