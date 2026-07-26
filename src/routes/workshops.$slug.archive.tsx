import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/workshops/$slug/archive")({
  beforeLoad: () => {
    throw redirect({ to: "/lounge", replace: true });
  },
  component: () => null,
});
