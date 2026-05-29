import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignIn } from "@/components/google-sign-in";
import { sanitizeInstagramHandle } from "@/lib/display-name";
import { attributeReferral, setReferredBy } from "@/lib/share.functions";
import { toast } from "sonner";

const REF_KEY = "signup-ref";

export const Route = createFileRoute("/signup")({
  component: Signup,
  validateSearch: (s: Record<string, unknown>) => ({
    email: typeof s.email === "string" ? s.email : undefined,
    first: typeof s.first === "string" ? s.first : undefined,
    last: typeof s.last === "string" ? s.last : undefined,
    ig: typeof s.ig === "string" ? s.ig : undefined,
    from: typeof s.from === "string" ? s.from : undefined,
    ref: typeof s.ref === "string" ? s.ref : undefined,
  }),
});

function Signup() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [firstName, setFirstName] = useState(search.first ?? "");
  const [lastName, setLastName] = useState(search.last ?? "");
  const [instagram, setInstagram] = useState(search.ig ?? "");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const fromGuest = search.from === "guest_apply";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      return toast.error("Please enter your first and last name.");
    }
    setLoading(true);
    const ig = sanitizeInstagramHandle(instagram);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          first_name: first,
          last_name: last,
          display_name: `${first} ${last}`,
          instagram_handle: ig || null,
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your inbox to confirm your email.");
    navigate({ to: "/onboarding" });
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-surface p-8 shadow-soft">
        <h1 className="font-display text-3xl text-ink">{fromGuest ? "Boost your application" : "Join Workshop"}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {fromGuest
            ? "Your application is sent. Finish your profile so the host can see your face and past work — applications from members get replied to faster."
            : "Find people. Make the thing. Show your Work."}
        </p>
        <div className="mt-6 space-y-3">
          <GoogleSignIn label="Sign up with Google" />
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-ink-muted">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
        </div>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first">First name</Label>
              <Input id="first" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last">Last name</Label>
              <Input id="last" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-ink-muted -mt-1">
            We show your first name and last initial (e.g. "{(firstName || "Jane").trim()} {(lastName.trim()[0] || "S").toUpperCase()}.") as a light trust signal. Your public @handle is separate.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ig">Instagram <span className="text-ink-muted font-normal">(optional)</span></Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">@</span>
              <Input
                id="ig"
                value={instagram}
                onChange={(e) => setInstagram(sanitizeInstagramHandle(e.target.value))}
                placeholder="yourhandle"
                className="pl-7"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-ink-muted">
          Already here? <Link to="/login" className="text-gradient-motion hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
