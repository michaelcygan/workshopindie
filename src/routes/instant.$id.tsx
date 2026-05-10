import { createFileRoute, Navigate } from "@tanstack/react-router";

// Legacy user-spawned rooms have been retired. All Instant traffic flows
// through the curated channels at /instant.
export const Route = createFileRoute("/instant/$id")({
  component: () => <Navigate to="/instant" replace />,
});
