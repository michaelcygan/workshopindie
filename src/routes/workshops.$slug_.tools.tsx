import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/workshops/$slug_/tools")({
  beforeLoad: () => {
    throw redirect({ to: "/groups", replace: true });
  },
  component: () => null,
});
