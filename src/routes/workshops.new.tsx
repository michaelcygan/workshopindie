import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/workshops/new")({
  component: () => <ComingSoon title="Schedule a Workshop" blurb="Pick a category, set a clock, define roles. Coming up next." />,
});
