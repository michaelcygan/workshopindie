import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/workshops")({
  component: () => <ComingSoon title="Workshops" blurb="Browse, schedule, and join time-boxed creative sessions. Building this next." />,
});
