import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { claimAutoUsername } from "@/lib/account.functions";

export const Route = createFileRoute("/me/")({
  component: MeRedirect,
});

/**
 * /me is a thin redirect to the unified public profile at /u/$username.
 * If the user finished onboarding but somehow has no username (legacy bug),
 * mint one inline so the Profile button never dead-ends back to onboarding.
 */
function MeRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const claimHandle = useServerFn(claimAutoUsername);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username,onboarded")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      // A failed lookup is NOT the same as "never onboarded" — don't bounce
      // the member into onboarding on a transient/permission error.
      if (error) {
        setFailed(true);
        return;
      }
      if (!data?.onboarded) {
        navigate({ to: "/onboarding" });
        return;
      }
      let username = data.username;
      if (!username) {
        try {
          const r = await claimHandle();
          username = r.username;
        } catch {
          navigate({ to: "/onboarding" });
          return;
        }
      }
      if (cancelled) return;
      navigate({ to: "/$username", params: { username }, replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, navigate, claimHandle, attempt]);

  if (failed) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-ink">Couldn't open your profile</h1>
        <p className="mt-2 text-sm text-ink-muted">Something went wrong finding your handle.</p>
        <button
          onClick={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
          className="mt-6 rounded-md border border-border px-4 py-2 text-sm hover:bg-surface"
        >
          Try again
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center text-ink-muted">
      Loading your profile…
    </main>
  );
}

