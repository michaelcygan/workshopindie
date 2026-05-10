import { createFileRoute, Navigate } from "@tanstack/react-router";

// Spawning rooms is gone. Instant is now two curated channels.
export const Route = createFileRoute("/instant/new")({
  component: () => <Navigate to="/instant" replace />,
});
