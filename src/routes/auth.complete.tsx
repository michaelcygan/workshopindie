import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

/**
 * The single post-auth return route for every provider: Google, Apple, and
 * email confirmation all come back here.
 *
 * It does not decide first-run: it waits for the session, then hands off to the
 * member homepage where the account lifecycle coordinator owns age, welcome,
 * and resuming the originating action. No tokens are read, stored, or logged.
 */
export const Route = createFileRoute("/auth/complete")({
  component: AuthComplete,
  validateSearch: (s: Record<string, unknown>): { error?: string; error_description?: string } => ({
    error: typeof s.error === "string" ? s.error : undefined,
    error_description: typeof s.error_description === "string" ? s.error_description : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Signing you in — Workshop" },
      { name: "description", content: "Finishing your Workshop sign-in." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const TIMEOUT_MS = 12_000;

function AuthComplete() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [timedOut, setTimedOut] = useState(false);

  const providerError = search.error ? search.error_description || search.error : null;

  useEffect(() => {
    if (providerError) return;
    if (loading) return;
    if (user) {
      navigate({ to: "/", replace: true });
      return;
    }
    const t = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [user, loading, navigate, providerError]);

  if (providerError || timedOut) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 text-center">
        <h1 className="font-display text-2xl text-ink">We couldn't finish signing you in</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {providerError ?? "Your sign-in didn't come back in time."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button className="rounded-full" onClick={() => navigate({ to: "/login" })}>
            Try again
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => navigate({ to: "/" })}>
            Go home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
      <p className="mt-4 text-sm text-ink-muted">Opening Workshop…</p>
    </div>
  );
}
