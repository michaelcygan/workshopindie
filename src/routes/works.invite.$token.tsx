import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy Work invite links. Removed with the collaborative-Work flow. */
export const Route = createFileRoute("/works/invite/$token")({
  beforeLoad: () => {
    throw redirect({ to: "/works/new", replace: true });
  },
});
