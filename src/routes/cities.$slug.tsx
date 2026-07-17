import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cities/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/g/$slug", params: { slug: params.slug } });
  },
});
