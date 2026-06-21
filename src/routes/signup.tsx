import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignIn } from "@/components/google-sign-in";
import { KickerChip } from "@/components/kicker-chip";
import { sanitizeInstagramHandle } from "@/lib/display-name";
import { attributeReferral, setReferredBy } from "@/lib/share.functions";
import { redeemGroupSeedLink } from "@/lib/group-seed-links.functions";
import { setMyBirthdate } from "@/lib/profile-age.functions";
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
    claim: typeof s.claim === "string" ? s.claim : undefined,
    join: typeof s.join === "string" ? s.join : undefined,
    group: typeof s.group === "string" ? s.group : undefined,
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
  const [birthdate, setBirthdate] = useState("");
  const [loading, setLoading] = useState(false);
  const fromGuest = search.from === "guest_apply";
  const lookupRef = useServerFn(attributeReferral);
  const writeRef = useServerFn(setReferredBy);
  const redeemSeed = useServerFn(redeemGroupSeedLink);
  const saveBirthdate = useServerFn(setMyBirthdate);

  // Today minus 18y — the date input refuses anything younger.
  const maxBirthdate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().slice(0, 10);
  })();

  // Stash seed-link token in sessionStorage so OAuth round-trips still join the group.
  useEffect(() => {
    if (search.join && search.group && typeof window !== "undefined") {
      try {
        sessionStorage.setItem(
          "ws.pendingGroupJoin",
          JSON.stringify({ token: search.join, slug: search.group }),
        );
      } catch { /* ignore */ }
    }
  }, [search.join, search.group]);


  // Capture ?ref=<username> into sessionStorage so OAuth round-trips preserve it
  useEffect(() => {
    if (search.ref && typeof window !== "undefined") {
      sessionStorage.setItem(REF_KEY, search.ref.toLowerCase());
    }
  }, [search.ref]);

  async function applyReferral(newUserId: string) {
    const ref = (typeof window !== "undefined" && sessionStorage.getItem(REF_KEY)) || null;
    if (!ref) return;
    try {
      const r = await lookupRef({ data: { referrerUsername: ref } });
      if (r.ok && r.referrerId) {
        await writeRef({ data: { userId: newUserId, referrerId: r.referrerId } });
      }
    } catch {
      /* non-fatal */
    } finally {
      sessionStorage.removeItem(REF_KEY);
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
    const { data, error } = await supabase.auth.signUp({
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
    if (data.user?.id) await applyReferral(data.user.id);
    toast.success("Check your inbox to confirm your email.");
    if (search.claim) {
      navigate({ to: "/collab/claim/$token", params: { token: search.claim } });
      return;
    }
    // Seed-link auto-join: try to redeem immediately (works if email confirmation
    // is off, i.e. session exists). Otherwise the __root.tsx auth listener will
    // pick up sessionStorage on SIGNED_IN.
    if (search.join && search.group) {
      try {
        await redeemSeed({ data: { token: search.join } });
        if (typeof window !== "undefined") sessionStorage.removeItem("ws.pendingGroupJoin");
      } catch { /* listener will retry post-confirmation */ }
      navigate({ to: "/g/$slug", params: { slug: search.group } });
      return;
    }
    navigate({ to: "/onboarding" });
  };



  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-4 flex items-center gap-2">
        <KickerChip live>{search.join && search.group ? `Joining ${search.group}` : "Join the night"}</KickerChip>
        <span className="text-xs text-ink-muted">{fromGuest ? "Finish your profile" : "Free to start"}</span>
      </div>

      <h1 className="font-display text-3xl leading-[1.05] text-ink md:text-4xl">
        {fromGuest ? "Boost your application." : "Find people. Make the thing."}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        {fromGuest
          ? "Your application is sent. Members get replied to faster — finish your profile so the host can see your face and past work."
          : "Show your Work. Walk into a live Workshop, or post a Collab and pull one together."}
      </p>
      <div className="mt-6 rounded-3xl border border-border bg-surface p-8 shadow-soft">
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
      </div>
    </div>
  );
}
