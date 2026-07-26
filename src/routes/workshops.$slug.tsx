import { createFileRoute, redirect } from "@tanstack/react-router";

// /workshops/$slug retired — everything live is /lounge now.
export const Route = createFileRoute("/workshops/$slug")({
  beforeLoad: () => {
    throw redirect({ to: "/lounge", replace: true });
  },
  component: () => null,
});
