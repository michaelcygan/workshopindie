import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/collab")({
  component: () => <ComingSoon title="Collab Board" blurb="Post or browse open collaboration requests for ideas already in motion." />,
});
