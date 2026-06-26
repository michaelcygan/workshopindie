import { createFileRoute, redirect } from "@tanstack/react-router";

// The Lobby flow is retired. Drop into a Lounge instead.
export const Route = createFileRoute("/workshops/lobby/new")({
  beforeLoad: () => {
    throw redirect({ to: "/lounge", replace: true });
  },
  component: () => null,
});
