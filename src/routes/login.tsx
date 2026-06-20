import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignIn } from "@/components/google-sign-in";
import { KickerChip } from "@/components/kicker-chip";
import { redeemGroupSeedLink } from "@/lib/group-seed-links.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: Login,
  validateSearch: (s: Record<string, unknown>) => ({
    claim: typeof s.claim === "string" ? s.claim : undefined,
    join: typeof s.join === "string" ? s.join : undefined,
    group: typeof s.group === "string" ? s.group : undefined,
  }),
});


function Login() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (search.claim) {
      navigate({ to: "/collab/claim/$token", params: { token: search.claim } });
    } else {
      navigate({ to: "/" });
    }
  };


  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-4 flex items-center gap-2">
        <KickerChip>Welcome back</KickerChip>
        <span className="text-xs text-ink-muted">Sign in to keep going</span>
      </div>
      <h1 className="font-display text-3xl leading-[1.05] text-ink md:text-4xl">
        Make something tonight.
      </h1>
      <div className="mt-6 rounded-3xl border border-border bg-surface p-8 shadow-soft">
        <div className="space-y-3">
          <GoogleSignIn />
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-ink-muted">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
        </div>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs text-ink-muted hover:underline">Forgot?</Link>
            </div>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-ink-muted">
          New to Workshop? <Link to="/signup" className="text-gradient-motion hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
