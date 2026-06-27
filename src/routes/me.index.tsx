import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
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

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username,onboarded")
        .eq("id", user.id)
        .maybeSingle();
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
      navigate({ to: "/u/$username", params: { username }, replace: true });
    })();
  }, [user, loading, navigate, claimHandle]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center text-ink-muted">
      Loading your profile…
    </main>
  );
}
