import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/me")({
  component: () => <ComingSoon title="Your portfolio" blurb="Works you ship will land here automatically. Profile UI is next." />,
});
