import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy collaborative-Work creator. Removed — finished pieces are published
 *  through /works/new and shared authorship is recorded with credits. */
export const Route = createFileRoute("/works/collab/new")({
  beforeLoad: () => {
    throw redirect({ to: "/works/new", replace: true });
  },
});
