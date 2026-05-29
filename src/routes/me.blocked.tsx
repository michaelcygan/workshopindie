import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/me/blocked")({
  component: () => <Navigate to="/settings" hash="blocked" replace />,
  head: () => ({
    meta: [{ title: "Blocked users — Workshop" }, { name: "robots", content: "noindex" }],
  }),
});
