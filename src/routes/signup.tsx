import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { safeDestination } from "@/lib/safe-destination";
import { setPostAuthIntent } from "@/lib/post-auth-intent";
import { AUTH_CALLBACK_PATH } from "@/lib/auth-launcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignIn } from "@/components/google-sign-in";
import { AppleSignIn } from "@/components/apple-sign-in";
import { KickerChip } from "@/components/kicker-chip";
import { sanitizeInstagramHandle } from "@/lib/display-name";
import { toast } from "sonner";

const REF_KEY = "signup-ref";

export const Route = createFileRoute("/signup")({
  component: Signup,
  validateSearch: (
    s: Record<string, unknown>,
  ): {
    email?: string;
    first?: string;
    last?: string;
    ig?: string;
    from?: string;
    ref?: string;
    claim?: string;
    join?: string;
    group?: string;
    redirect?: string;
  } => ({
    email: typeof s.email === "string" ? s.email : undefined,
    first: typeof s.first === "string" ? s.first : undefined,
    last: typeof s.last === "string" ? s.last : undefined,
    ig: typeof s.ig === "string" ? s.ig : undefined,
    from: typeof s.from === "string" ? s.from : undefined,
    ref: typeof s.ref === "string" ? s.ref : undefined,
    claim: typeof s.claim === "string" ? s.claim : undefined,
    join: typeof s.join === "string" ? s.join : undefined,
    group: typeof s.group === "string" ? s.group : undefined,
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
});

function Signup() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user: signedInUser, loading: authLoading } = useAuth();

  const [firstName, setFirstName] = useState(search.first ?? "");
  const [lastName, setLastName] = useState(search.last ?? "");
  const [instagram, setInstagram] = useState(search.ig ?? "");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const fromGuest = search.from === "guest_apply";

  // Capture ?ref=<username> into sessionStorage so OAuth round-trips preserve it.
  // The PostAuthRunner migrates this into referral attribution once the lifecycle is ready.
  useEffect(() => {
    if (search.ref && typeof window !== "undefined") {
      sessionStorage.setItem(REF_KEY, search.ref.toLowerCase());
    }
  }, [search.ref]);

  // A completed OAuth round-trip lands back here with a session — don't leave
  // the user staring at the signup form.
  useEffect(() => {
    if (authLoading || !signedInUser) return;
    setPostAuthIntentFromSearch(search);
    window.location.assign(AUTH_CALLBACK_PATH);
  }, [signedInUser, authLoading, search.claim, search.join, search.group, search.redirect]);

  function setPostAuthIntentFromSearch(s: typeof search) {
    if (s.claim) {
      setPostAuthIntent({ kind: "return_to", returnTo: `/collab/claim/${s.claim}` });
    } else if (s.join && s.group) {
      setPostAuthIntent({
        kind: "group_seed_join",
        payload: { token: s.join, slug: s.group },
        returnTo: `/g/${s.group}`,
      });
    } else {
      const dest = safeDestination(s.redirect);
      if (dest) setPostAuthIntent({ kind: "return_to", returnTo: dest });
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      return toast.error("Please enter your first and last name.");
    }
    setLoading(true);
    const ig = sanitizeInstagramHandle(instagram);
    setPostAuthIntentFromSearch(search);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${AUTH_CALLBACK_PATH}`,
        data: {
          first_name: first,
          last_name: last,
          display_name: `${first} ${last}`,
          instagram_handle: ig || null,
        },
      },
    });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    setLoading(false);
    if (data.session) {
      // Email confirmation is off; session is active. The lifecycle coordinator takes over.
      window.location.assign(AUTH_CALLBACK_PATH);
      return;
    }
    // Email confirmation is on: the user must click the link before the lifecycle runs.
    toast.success("Check your inbox to confirm your email.");
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-4 flex items-center gap-2">
        <KickerChip live>
          {search.join && search.group ? `Joining ${search.group}` : "Join the night"}
        </KickerChip>
        <span className="text-xs text-ink-muted">
          {fromGuest ? "Finish your profile" : "Free to start"}
        </span>
      </div>

      <h1 className="font-display text-3xl leading-[1.05] text-ink md:text-4xl">
        {fromGuest ? "Boost your application." : "Find people. Make the thing."}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        {fromGuest
          ? "Your application is sent. Members get replied to faster — finish your profile so the host can see your face and past work."
          : "Show your Work. Join a Group, or post a Collab and pull a team together."}
      </p>
      <div className="mt-6 rounded-xl border border-border bg-surface p-8 shadow-soft">
        <div className="mt-6 space-y-3">
          <GoogleSignIn
            label="Sign up with Google"
            redirectTo={
              search.redirect && search.redirect.startsWith("/") ? search.redirect : undefined
            }
          />
          <AppleSignIn
            label="Sign up with Apple"
            redirectTo={
              search.redirect && search.redirect.startsWith("/") ? search.redirect : undefined
            }
          />
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-ink-muted">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
        </div>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first">First name</Label>
              <Input
                id="first"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last">Last name</Label>
              <Input
                id="last"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-ink-muted -mt-1">
            We show your first name and last initial (e.g. "{(firstName || "Jane").trim()}{" "}
            {(lastName.trim()[0] || "S").toUpperCase()}.") as a light trust signal. Your public
            @handle is separate.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ig">
              Instagram <span className="text-ink-muted font-normal">(optional)</span>
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
                @
              </span>
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
          <Button type="submit" className="w-full rounded-md" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-center text-[11px] text-ink-muted">
            By creating an account you confirm you are at least 18 years old.
          </p>
        </form>
        <p className="mt-6 text-center text-sm text-ink-muted">
          Already here?{" "}
          <Link to="/login" className="text-signal hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
