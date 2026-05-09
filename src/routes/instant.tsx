import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/instant")({
  component: () => <ComingSoon title="Instant" blurb="Lightweight always-on rooms by category and city. Drop in to meet collaborators." />,
});
