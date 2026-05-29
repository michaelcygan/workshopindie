import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/me/")({
  component: MeRedirect,
});

/**
 * /me is a thin redirect to the unified public profile at /u/$username.
 * Instagram-style: one profile. Owner-only flourishes are gated by isOwn there.
 */
function MeRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

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
      if (!data?.onboarded || !data?.username) {
        navigate({ to: "/onboarding" });
        return;
      }
      navigate({ to: "/u/$username", params: { username: data.username }, replace: true });
    })();
  }, [user, loading, navigate]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center text-ink-muted">
      Loading your profile…
    </main>
  );
}
