import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { safeDestination } from "@/lib/safe-destination";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
});

/**
 * Onboarding is no longer a mandatory first-run destination. The account
 * lifecycle gate (Age → Welcome) owns first-run. This route is kept as a
 * friendly redirect for any old bookmarks/links, and sends authenticated users
 * to the profile editor. Unauthenticated users are sent to log in.
 */
function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  useEffect(() => {
    if (loading) return;
    const next = safeDestination(search.next) ?? "/me/edit";
    if (user) {
      navigate({ to: next as never, replace: true });
    }
  }, [user, loading, search.next, navigate]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10 text-center">
      <h1 className="font-display text-3xl text-ink">Create your account to continue</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Workshop uses one lightweight first-run flow after you sign in.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          to="/signup"
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Sign up
        </Link>
        <Link
          to="/login"
          className="rounded-full border border-border px-5 py-2 text-sm font-medium text-ink hover:bg-surface"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
