import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/workshops/$slug/tools/$tool")({
  beforeLoad: () => {
    throw redirect({ to: "/groups", replace: true });
  },
  component: () => null,
});
