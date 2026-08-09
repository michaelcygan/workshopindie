import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { safeDestination } from "@/lib/safe-destination";
import { setPostAuthIntent } from "@/lib/post-auth-intent";
import { AUTH_CALLBACK_PATH } from "@/lib/auth-launcher";
import { checkEmailExists } from "@/lib/auth-email.functions";
import { stashHandoffPassword, takeHandoffPassword } from "@/lib/auth-handoff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignIn } from "@/components/google-sign-in";
import { AppleSignIn } from "@/components/apple-sign-in";
import { KickerChip } from "@/components/kicker-chip";
import { toast } from "sonner";
import { workshopEntityUrl } from "@/lib/entities/kinds";

export const Route = createFileRoute("/login")({
  component: Login,
  validateSearch: (
    s: Record<string, unknown>,
  ): { claim?: string; join?: string; group?: string; redirect?: string; email?: string } => ({
    claim: typeof s.claim === "string" ? s.claim : undefined,
    join: typeof s.join === "string" ? s.join : undefined,
    group: typeof s.group === "string" ? s.group : undefined,
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    email: typeof s.email === "string" ? s.email : undefined,
  }),
});


function Login() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState(() => takeHandoffPassword());
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();

  // Already signed in? Never sit on the auth form — go to the lifecycle coordinator.
  useEffect(() => {
    if (authLoading || !user) return;
    setPostAuthIntentFromSearch(search);
    window.location.assign(AUTH_CALLBACK_PATH);
  }, [user, authLoading, search.claim, search.join, search.group, search.redirect]);

  function setPostAuthIntentFromSearch(s: typeof search) {
    if (s.claim) {
      setPostAuthIntent({ kind: "return_to", returnTo: `/collab/claim/${s.claim}` });
    } else if (s.join && s.group) {
      setPostAuthIntent({
        kind: "group_seed_join",
        payload: { token: s.join, slug: s.group },
        returnTo: workshopEntityUrl({ kind: "group", slug: s.group }),
      });
    } else {
      const dest = safeDestination(s.redirect);
      if (dest) setPostAuthIntent({ kind: "return_to", returnTo: dest });
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      setLoading(false);
      setPostAuthIntentFromSearch(search);
      window.location.assign(AUTH_CALLBACK_PATH);
      return;
    }

    // No account with this email? Don't dead-end — start the signup flow instead.
    const credentialFailure = /invalid login credentials/i.test(error.message);
    if (credentialFailure) {
      const probe = await checkEmailExists({ data: { email: email.trim() } }).catch(() => null);
      if (probe && probe.exists === false) {
        setLoading(false);
        stashHandoffPassword(password);
        toast.info("No account yet — let's make one.");
        navigate({
          to: "/signup",
          search: { ...search, email: email.trim() },
        });
        return;
      }
      setLoading(false);
      return toast.error("That password doesn't match. Try again or reset it.");
    }

    setLoading(false);
    toast.error(error.message);
  };


  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-4 flex items-center gap-2">
        <KickerChip>
          {search.join && search.group ? `Joining ${search.group}` : "Welcome back"}
        </KickerChip>
        <span className="text-xs text-ink-muted">Sign in to keep going</span>
      </div>

      <h1 className="font-display text-3xl leading-[1.05] text-ink md:text-4xl">
        Make something today.
      </h1>
      <div className="mt-6 rounded-xl border border-border bg-surface p-8 shadow-soft">
        <div className="space-y-3">
          <GoogleSignIn
            redirectTo={
              search.redirect && search.redirect.startsWith("/") ? search.redirect : undefined
            }
          />
          <AppleSignIn
            redirectTo={
              search.redirect && search.redirect.startsWith("/") ? search.redirect : undefined
            }
          />
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-ink-muted">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
        </div>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs text-ink-muted hover:underline">
                Forgot?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full rounded-md" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-ink-muted">
          New to Workshop?{" "}
          <Link
            to="/signup"
            search={search.redirect ? { redirect: search.redirect } : undefined}
            className="text-signal hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
