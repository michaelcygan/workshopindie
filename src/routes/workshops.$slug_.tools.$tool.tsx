import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/workshops/$slug_/tools/$tool")({
  beforeLoad: () => {
    throw redirect({ to: "/groups", replace: true });
  },
  component: () => null,
});
