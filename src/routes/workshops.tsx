import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useUserRoles } from "@/hooks/use-user-role";
import { useAuth } from "@/hooks/use-auth";
import { ComingSoon } from "@/components/coming-soon";

function WorkshopsLayout() {
  const { loading: authLoading } = useAuth();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  if (authLoading || rolesLoading) {
    return <main className="mx-auto max-w-2xl p-10"><div className="h-40 animate-pulse rounded-3xl bg-surface-2" /></main>;
  }
  if (!isAdmin) {
    return (
      <ComingSoon
        title="Scheduled Workshops"
        blurb="Coming soon — for now, drop into a live Workshop or post a Collab to find people."
        ctaLabel="Back to home"
      />
    );
  }
  return <Outlet />;
}

export const Route = createFileRoute("/workshops")({ component: WorkshopsLayout });
