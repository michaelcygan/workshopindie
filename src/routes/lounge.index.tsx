import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * `/lounge` is compatibility only. Groups own the live layer now (Today chat +
 * the Group audio dock), so this path forwards to `/groups` instead of
 * competing as a destination. The underlying Lounge server functions and
 * tables remain intact so existing links and audio rooms keep working.
 */
export const Route = createFileRoute("/lounge/")({
  beforeLoad: () => {
    throw redirect({ to: "/groups" });
  },
  component: () => null,
  head: () => ({
    meta: [
      { title: "Group audio — moved to Groups" },
      {
        name: "description",
        content: "Group audio now lives inside Groups. Redirecting you to Groups.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
