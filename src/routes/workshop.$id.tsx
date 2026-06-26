import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/workshop/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/lounge/$id", params: { id: params.id }, replace: true });
  },
  component: () => null,
});
