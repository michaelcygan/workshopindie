import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/collab/new")({
  component: () => <ComingSoon title="Post a Collab" blurb="Describe your idea and the roles you need. Building the form next." />,
});
