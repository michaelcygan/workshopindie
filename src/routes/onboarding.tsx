import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type Category, categoryClass } from "@/lib/categories";
import { WORK_MEDIUMS, EXTRA_MEDIUMS, type ExtraMedium } from "@/lib/mediums";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RequireAuth } from "@/components/require-auth";
import { deriveDisplayName } from "@/lib/display-name";
import { setMyBirthdate, getMyAgeFields } from "@/lib/profile-age.functions";
import { claimAutoUsername } from "@/lib/account.functions";
import { attributeReferral, setReferredBy } from "@/lib/share.functions";
import { OnboardingGroupsStep } from "@/components/onboarding-groups-step";

const REF_KEY = "signup-ref";


export const Route = createFileRoute("/onboarding")({
  component: () => <RequireAuth><Onboarding /></RequireAuth>,
});

function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const saveBirthdate = useServerFn(setMyBirthdate);
  const fetchAge = useServerFn(getMyAgeFields);
  const claimHandle = useServerFn(claimAutoUsername);
  const lookupRef = useServerFn(attributeReferral);
  const writeRef = useServerFn(setReferredBy);


  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthdate, setBirthdate] = useState(""); // YYYY-MM-DD
  const [bio, setBio] = useState("");
  const [cats, setCats] = useState<Category[]>([]);
  const [mediums, setMediums] = useState<ExtraMedium[]>([]);
  const [cities, setCities] = useState<{ id: string; name: string; country: string }[]>([]);
  const [cityId, setCityId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState<"basics" | "groups">("basics");
  const [hasNameAlready, setHasNameAlready] = useState(false);
  const [hasDobAlready, setHasDobAlready] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    supabase.from("cities").select("id,name,country").order("name").then(({ data }) => {
      if (data) setCities(data);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata ?? {};
    if (meta.first_name) setFirstName(String(meta.first_name));
    if (meta.last_name) setLastName(String(meta.last_name));
    // Pre-load profile so we can skip fields the user already filled at signup.
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name,last_name,bio,city_id,home_city_id,categories,mediums")
        .eq("id", user.id)
        .maybeSingle();
      if (!data) return;
      if (data.first_name) { setFirstName(data.first_name); }
      if (data.last_name) { setLastName(data.last_name); }
      if (data.first_name && data.last_name) setHasNameAlready(true);
      if (data.bio) setBio(data.bio);
      if (data.home_city_id || data.city_id) setCityId(String(data.home_city_id ?? data.city_id));
      if (Array.isArray(data.categories)) setCats(data.categories as Category[]);
      if (Array.isArray(data.mediums)) setMediums(data.mediums as ExtraMedium[]);
    })();
    fetchAge().then((r) => {
      if (r.birthdate) { setBirthdate(String(r.birthdate)); setHasDobAlready(true); }
    }).catch(() => { /* ignore */ });
  }, [user, fetchAge]);

  const toggleCat = (c: Category) =>
    setCats((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  // Max date = today minus 18 years (Workshop is 18+).
  const maxBirthdate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().slice(0, 10);
  })();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!firstName.trim() || !lastName.trim()) return toast.error("Please enter your first and last name.");
    if (!birthdate) return toast.error("Please enter your date of birth.");
    if (!cityId) return toast.error("Please pick your home city — it powers your feed.");
    setSaving(true);

    if (!hasDobAlready) {
      try {
        await saveBirthdate({ data: { birthdate } });
      } catch (err) {
        setSaving(false);
        return toast.error(err instanceof Error ? err.message : "Couldn't save date of birth.");
      }
    }

    const display = deriveDisplayName(firstName, lastName);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name: display,
        bio: bio || null,
        categories: cats,
        mediums: mediums,
        city_id: cityId,
        home_city_id: cityId,
        onboarded: true,
      })
      .eq("id", user.id);
    if (error) { setSaving(false); return toast.error(error.message); }

    // Mint a public @handle so /me works immediately and the profile is shareable.
    try {
      await claimHandle();
    } catch {
      /* non-fatal — user can claim one in profile settings */
    }

    setSaving(false);
    // Apply referral attribution (covers Google OAuth users — /signup also tries)
    try {
      const ref = sessionStorage.getItem(REF_KEY);
      if (ref) {
        const r = await lookupRef({ data: { referrerUsername: ref } });
        if (r.ok && r.referrerId) {
          await writeRef({ data: { userId: user.id, referrerId: r.referrerId } });
        }
        sessionStorage.removeItem(REF_KEY);
      }
    } catch { /* non-fatal */ }
    toast.success("Profile created");
    setStage("groups");
  };


  function finishOnboarding() {
    try { sessionStorage.setItem("ws.welcome_open", "1"); } catch { /* ignore */ }
    navigate({ to: "/" });
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-surface p-8 shadow-soft">
        {stage === "groups" ? (
          <OnboardingGroupsStep
            homeCityId={cityId || null}
            onDone={finishOnboarding}
            onSkip={finishOnboarding}
          />
        ) : (
          <>
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">Welcome to Workshop</p>
        <h1 className="mt-1 font-display text-3xl text-ink">Create your profile</h1>
        <p className="mt-1 text-sm text-ink-muted">A few quick details so people can credit you and your feed knows where you are. You can change anything later.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          {!hasNameAlready && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first">First name <span className="text-destructive">*</span></Label>
                  <Input id="first" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last">Last name <span className="text-destructive">*</span></Label>
                  <Input id="last" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <p className="-mt-3 text-xs text-ink-muted">This is how you'll be credited on works and collabs. You can claim a public @handle later.</p>
            </>
          )}

          {!hasDobAlready && (
            <div className="space-y-1.5">
              <Label htmlFor="dob">Date of birth <span className="text-destructive">*</span></Label>
              <Input
                id="dob"
                type="date"
                required
                max={maxBirthdate}
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
              />
              <p className="text-xs text-ink-muted">Workshop is 18+. Private — never shown on your profile.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Home city <span className="text-ink-muted">(required)</span></Label>
            <select
              required
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Select city —</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}, {c.country}</option>
              ))}
            </select>
            <p className="text-xs text-ink-muted">Your home city powers your feed. You can change it once every 30 days.</p>
          </div>

          <div className="space-y-2">
            <Label>What do you make?</Label>
            <div className="flex flex-wrap gap-2">
              {WORK_MEDIUMS.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => toggleCat(c.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition",
                    cats.includes(c.id)
                      ? cn("border-transparent", categoryClass(c.id))
                      : "border-border bg-surface text-ink-soft hover:bg-muted",
                  )}
                >
                  {c.label}
                </button>
              ))}
              {EXTRA_MEDIUMS.map((m) => {
                const on = mediums.includes(m.id);
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setMediums((cur) => (on ? cur.filter((x) => x !== m.id) : [...cur, m.id]))}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition",
                      on ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted",
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-ink-muted">Pick all that apply. You can refine later.</p>
          </div>


          <div className="space-y-1.5">
            <Label htmlFor="bio">Short bio (optional)</Label>
            <Textarea id="bio" rows={3} maxLength={280} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="One line about your work." />
          </div>

          <Button type="submit" className="w-full rounded-full" disabled={saving}>
            {saving ? "Saving…" : "Continue"}
          </Button>

        </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
