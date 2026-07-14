import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  User as UserIcon,
  Sparkles,
  Lock,
  Ban,
  ShieldAlert,
  Mail,
  KeyRound,
  ExternalLink,
  ArrowLeft,
  Bell,
  Languages,
  MapPin,
  Download,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePlus } from "@/hooks/use-plus";
import { getStripeEnvironment } from "@/lib/stripe";
import { createPortalSession } from "@/lib/payments.functions";
import { getMyAgeFields, setMyAgeFilter } from "@/lib/profile-age.functions";
import { getMyPrivacy, updateMyPrivacy, deleteMyAccount, exportMyData } from "@/lib/account.functions";
import { getMyCcConsent, setMyCcConsent } from "@/lib/cc-consent.functions";
import {
  getMyNotifPrefs,
  updateMyNotifPrefs,
  type NotifPrefKey,
  type NotifPrefs,
} from "@/lib/notifications-prefs.functions";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CityCombobox, type CityValue } from "@/components/city-combobox";
import { RequireAuth } from "@/components/require-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  component: () => (
    <RequireAuth>
      <SettingsPage />
    </RequireAuth>
  ),
  head: () => ({
    meta: [
      { title: "Settings — Workshop" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type SectionId = "account" | "plus" | "notifications" | "privacy" | "safety" | "data";
const SECTIONS: { id: SectionId; label: string; icon: typeof UserIcon }[] = [
  { id: "account", label: "Account", icon: UserIcon },
  { id: "plus", label: "Plus membership", icon: Sparkles },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Privacy", icon: Lock },
  { id: "safety", label: "Safety", icon: Ban },
  { id: "data", label: "Your data", icon: Download },
];

// Legacy hash aliases so old bookmarks still land in the right place.
const HASH_ALIASES: Record<string, SectionId> = {
  blocked: "safety",
  reports: "safety",
  danger: "data",
};

function SettingsPage() {
  const [active, setActive] = useState<SectionId>("account");
  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
    account: null,
    plus: null,
    notifications: null,
    privacy: null,
    safety: null,
    data: null,
  });

  // Honor #hash on first paint
  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
    const id = (HASH_ALIASES[raw] ?? (SECTIONS.some((s) => s.id === raw) ? (raw as SectionId) : null));
    if (id) {
      setActive(id);
      requestAnimationFrame(() => {
        sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

  const scrollTo = (id: SectionId) => {
    setActive(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <Link to="/me" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to profile
      </Link>
      <h1 className="mt-3 font-display text-3xl text-ink md:text-4xl">Settings</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Account, membership, and privacy. Looking to edit your bio or pinned works?{" "}
        <Link to="/me/edit" className="underline underline-offset-2 hover:text-ink">
          Edit profile →
        </Link>
      </p>

      <div className="mt-8 grid gap-8 md:grid-cols-[200px_1fr]">
        {/* TOC */}
        <aside className="md:sticky md:top-20 md:self-start">
          <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const on = active === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollTo(s.id)}
                  className={cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition md:rounded-lg md:px-3 md:py-2",
                    on
                      ? "bg-muted text-ink"
                      : "text-ink-soft hover:bg-muted/60 hover:text-ink",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {s.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Sections */}
        <div className="space-y-10">
          <Section id="account" title="Account" subtitle="Sign-in identity and date of birth." refMap={sectionRefs}>
            <AccountSection />
          </Section>

          <Section id="plus" title="Plus membership" subtitle="Manage your Galleryhop Plus subscription." refMap={sectionRefs}>
            <PlusSection />
          </Section>

          <Section id="notifications" title="Notifications" subtitle="Pick what reaches your inbox and what stays in the bell." refMap={sectionRefs}>
            <NotificationsSection />
          </Section>

          <Section id="privacy" title="Privacy" subtitle="Control who can reach you, how you appear, and how your Lounge contributions are licensed." refMap={sectionRefs}>
            <PrivacySection />
          </Section>

          <Section id="safety" title="Safety" subtitle="Blocked users and reports you've filed." refMap={sectionRefs}>
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-sm font-medium text-ink">Blocked users</h3>
                <BlockedSection />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-ink">My reports</h3>
                <ReportsSection />
              </div>
            </div>
          </Section>

          <Section id="data" title="Your data" subtitle="Export your data, or delete your account." refMap={sectionRefs}>
            <div className="space-y-6">
              <DataSection />
              <div>
                <h3 className="mb-2 text-sm font-medium text-ink flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-destructive" /> Delete account
                </h3>
                <DangerSection />
              </div>
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({
  id,
  title,
  subtitle,
  children,
  refMap,
}: {
  id: SectionId;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  refMap: React.MutableRefObject<Record<SectionId, HTMLElement | null>>;
}) {
  return (
    <section
      id={id}
      ref={(el) => {
        refMap.current[id] = el;
      }}
      className="scroll-mt-20"
    >
      <header className="mb-3">
        <h2 className="font-display text-xl text-ink">{title}</h2>
        {subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

/* ----------------- Account ----------------- */

const LANGUAGE_OPTIONS: { v: string; label: string }[] = [
  { v: "en", label: "English" },
  // Future: add more languages here. Drives a Workshop language filter.
];

function AccountSection() {
  const { user } = useAuth();
  const qc = useQueryClient();




  const [resetting, setResetting] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  // OAuth-vs-password detection. Supabase exposes `providers` on app_metadata
  // when a user signs in with Google/GitHub/etc. We treat "email" as the only
  // provider that supports password reset.
  const providers = ((user?.app_metadata?.providers as string[] | undefined) ?? []).filter(Boolean);
  const hasPassword = providers.length === 0 || providers.includes("email");
  const oauthOnly = !hasPassword;
  const oauthLabel = providers
    .filter((p) => p !== "email")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(", ");


  const ageFieldsFn = useServerFn(getMyAgeFields);
  const { data: ageInfo } = useQuery({
    queryKey: ["my-age-fields"],
    queryFn: () => ageFieldsFn(),
  });

  const { data: prefs, isLoading: prefsLoading } = useQuery({
    queryKey: ["my-account-prefs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("preferred_language, home_city_id, home_city:cities!profiles_home_city_id_fkey(id,name,country)")
        .eq("id", user.id)
        .maybeSingle();
      return {
        language: (data?.preferred_language as string | null) ?? "en",
        city: (data?.home_city ?? null) as CityValue | null,
      };
    },
  });

  async function saveLanguage(lang: string) {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ preferred_language: lang }).eq("id", user.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["my-account-prefs"] });
    toast.success("Language saved");
  }

  async function saveCity(city: CityValue | null) {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        home_city_id: city?.id ?? null,
        home_city_changed_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["my-account-prefs"] });
    toast.success(city ? "Default city saved" : "Default city cleared");
  }

  async function sendPasswordReset() {
    if (!user?.email) return toast.error("No email on file.");
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setResetting(false);
    if (error) return toast.error(error.message);
    toast.success(`Reset link sent to ${user.email}`);
  }

  async function changeEmail() {
    const trimmed = newEmail.trim();
    if (!trimmed || !/^.+@.+\..+$/.test(trimmed)) {
      return toast.error("Enter a valid email.");
    }
    setEmailBusy(true);
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    setEmailBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Confirmation sent to ${trimmed}. Click the link to finish the change.`);
    setEmailOpen(false);
    setNewEmail("");
  }




  const currentLang = prefs?.language ?? "en";

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <Row label="Email" icon={Mail}>
        <span className="truncate text-sm text-ink">{user?.email ?? "—"}</span>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => { setNewEmail(""); setEmailOpen(true); }}
        >
          Change
        </Button>
      </Row>
      <Row label="Password" icon={KeyRound}>
        {oauthOnly ? (
          <span className="text-sm text-ink-muted">
            Signed in with {oauthLabel || "a third-party provider"} — no password to manage.
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={resetting}
            onClick={sendPasswordReset}
          >
            {resetting ? "Sending…" : "Send reset link"}
          </Button>
        )}
      </Row>
      <Row label="Date of birth" icon={UserIcon}>
        <span className="text-sm text-ink">
          {ageInfo?.birthdate ? (
            <>
              {ageInfo.birthdate}
              <span className="ml-2 text-xs text-ink-muted">Locked after signup</span>
            </>
          ) : (
            <span className="text-ink-muted">Not set</span>
          )}
        </span>
      </Row>

      <Row label="Language" icon={Languages}>
        <select
          value={currentLang}
          disabled={prefsLoading}
          onChange={(e) => saveLanguage(e.target.value)}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {LANGUAGE_OPTIONS.map((o) => (
            <option key={o.v} value={o.v}>{o.label}</option>
          ))}
        </select>
      </Row>
      <div className="flex items-start gap-3 border-b border-border/60 py-3">
        <MapPin className="mt-2 h-4 w-4 shrink-0 text-ink-muted" />
        <div className="w-32 shrink-0 pt-2 text-sm text-ink-muted">Default city</div>
        <div className="ml-auto min-w-0 flex-1 max-w-sm">
          <CityCombobox
            value={prefs?.city ?? null}
            onChange={saveCity}
            placeholder="Search any city"
            disabled={prefsLoading}
          />
          <p className="mt-1 text-xs text-ink-muted">
            Scopes city pages, Lounges, and local discovery to your home base.
          </p>
        </div>
      </div>



      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change your sign-in email</DialogTitle>
            <DialogDescription>
              We'll send a confirmation link to the new address. The change only takes effect once you click it.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="email"
            autoFocus
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new@example.com"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailOpen(false)} disabled={emailBusy}>
              Cancel
            </Button>
            <Button onClick={changeEmail} disabled={emailBusy}>
              {emailBusy ? "Sending…" : "Send confirmation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof UserIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 py-3 last:border-b-0 last:pb-0 first:pt-0">
      <Icon className="h-4 w-4 shrink-0 text-ink-muted" />
      <div className="w-32 shrink-0 text-sm text-ink-muted">{label}</div>
      <div className="ml-auto flex min-w-0 items-center gap-2">{children}</div>
    </div>
  );
}

/* ----------------- Plus ----------------- */

function PlusSection() {
  const { isPlus, loading, subscription } = usePlus();
  const env = getStripeEnvironment();
  const portalFn = useServerFn(createPortalSession);
  const [opening, setOpening] = useState(false);

  async function openPortal() {
    setOpening(true);
    try {
      const url = await portalFn({
        data: { environment: env, returnUrl: `${window.location.origin}/settings#plus` },
      });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open billing portal.");
    } finally {
      setOpening(false);
    }
  }

  if (loading) {
    return <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />;
  }

  if (!isPlus) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 icon-gradient-motion" />
          <span className="font-medium text-ink">You're on the free plan.</span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Plus removes the 10-work portfolio cap, lets you keep multiple Open Collabs live,
          and unlocks unlimited Lounge time. $4.99/mo, cancel anytime.
        </p>
        <Link to="/pricing">
          <Button size="sm" className="mt-3 rounded-full">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Go Plus
          </Button>
        </Link>
      </div>
    );
  }

  const renewal = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null;
  const willCancel = !!subscription?.cancel_at_period_end;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
          <Sparkles className="h-3 w-3 icon-gradient-motion" />
          <span className="text-gradient-motion">Plus</span>
        </span>
        <span className="text-sm text-ink-muted">
          {subscription?.status === "trialing" ? "Free trial" : "Active"}
        </span>
      </div>
      {renewal && (
        <p className="mt-2 text-sm text-ink-muted">
          {willCancel ? "Access until " : "Renews on "}
          <span className="text-ink">
            {renewal.toLocaleDateString(undefined, { dateStyle: "long" })}
          </span>
          {willCancel && " · subscription canceled"}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={openPortal}
          disabled={opening}
        >
          {opening ? "Opening…" : "Manage billing"}
          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
        </Button>
        {willCancel && (
          <Link to="/pricing">
            <Button size="sm" className="rounded-full">
              Resume subscription
            </Button>
          </Link>
        )}
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Billing opens in a new tab. You'll come back to Settings when you're done.
      </p>
    </div>
  );
}

/* ----------------- Privacy ----------------- */

function PrivacySection() {
  const qc = useQueryClient();

  const getPrivacyFn = useServerFn(getMyPrivacy);
  const updatePrivacyFn = useServerFn(updateMyPrivacy);
  const getAgeFn = useServerFn(getMyAgeFields);
  const setAgeFilterFn = useServerFn(setMyAgeFilter);

  const { data: privacy, isLoading: pLoading } = useQuery({
    queryKey: ["my-privacy"],
    queryFn: () => getPrivacyFn(),
  });
  const { data: ageInfo } = useQuery({
    queryKey: ["my-age-fields"],
    queryFn: () => getAgeFn(),
  });

  async function update(patch: { dmPolicy?: "mutuals" | "everyone" | "nobody"; discoverable?: boolean; indexable?: boolean; showOnline?: boolean }) {
    try {
      await updatePrivacyFn({ data: patch });
      qc.invalidateQueries({ queryKey: ["my-privacy"] });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    }
  }

  async function setAgeFilter(v: number | null) {
    try {
      await setAgeFilterFn({ data: { ageFilterMin: v } });
      qc.invalidateQueries({ queryKey: ["my-age-fields"] });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    }
  }

  const ageOptions: { v: number | null; label: string }[] = [
    { v: null, label: "All ages" },
    { v: 18, label: "18+" },
    { v: 21, label: "21+" },
  ];
  const birthdateLocked = !!ageInfo?.birthdate;

  const dmOptions: { v: "mutuals" | "everyone" | "nobody"; label: string; hint: string }[] = [
    { v: "mutuals", label: "Mutuals only", hint: "Only people you follow back can start a new DM. (Recommended)" },
    { v: "everyone", label: "Anyone signed in", hint: "Anyone on Workshop can message you." },
    { v: "nobody", label: "No new DMs", hint: "No one can start a new conversation. Existing threads keep working." },
  ];
  const currentDm = (privacy?.dmPolicy ?? "mutuals") as "mutuals" | "everyone" | "nobody";

  return (
    <div className="space-y-4">
      {/* DMs */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="text-sm font-medium text-ink">Who can message me</div>
        <p className="mt-1 text-xs text-ink-muted">
          Collab applicants and Lounge hosts you've registered with can always reach you about that specific post.
        </p>
        <div className="mt-3 grid gap-2">
          {dmOptions.map((opt) => {
            const active = currentDm === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                disabled={pLoading}
                onClick={() => { if (!active) update({ dmPolicy: opt.v }); }}
                className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                  active ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                }`}
              >
                <span className={`mt-1 inline-block h-3.5 w-3.5 shrink-0 rounded-full border ${active ? "border-primary bg-primary" : "border-border"}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{opt.label}</span>
                  <span className="block text-xs text-ink-muted">{opt.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Discoverability */}
      <ToggleCard
        label="Show me in Local creators and city lists"
        description="When off, your profile is hidden from city pages and discovery rails. People with your link can still visit your profile."
        loading={pLoading}
        checked={privacy?.discoverable ?? true}
        onChange={(on) => update({ discoverable: on })}
      />

      {/* Indexable */}
      <ToggleCard
        label="Allow search engines to index my profile"
        description="When off, your public profile page tells Google and other crawlers not to index it."
        loading={pLoading}
        checked={privacy?.indexable ?? true}
        onChange={(on) => update({ indexable: on })}
      />

      {/* Online presence */}
      <ToggleCard
        label="Show me as 'online' to mutual follows"
        description="When on, people in your network see a green dot when you've been active in the last couple of minutes. Turn off to stay invisible."
        loading={pLoading}
        checked={privacy?.showOnline ?? true}
        onChange={(on) => update({ showOnline: on })}
      />

      {/* Age filter */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label className="text-sm font-medium text-ink">Lounges age filter</Label>
            <p className="mt-0.5 text-xs text-ink-muted">
              Only show Lounges scoped to this minimum age. Private to you.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ageOptions.map((opt) => {
            const on = (ageInfo?.ageFilterMin ?? null) === opt.v;
            return (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => setAgeFilter(opt.v)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition",
                  on
                    ? "border-transparent bg-ink text-background"
                    : "border-border bg-surface text-ink-soft hover:bg-muted",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {(ageInfo?.ageFilterMin ?? null) !== null && !birthdateLocked && (
          <p className="mt-2 text-xs text-amber-700">
            Add your date of birth on{" "}
            <Link to="/me/edit" className="underline">Edit profile</Link>{" "}
            to take effect.
          </p>
        )}
      </div>

      <CcConsentSection />
    </div>
  );
}

/* ----------------- Creative Commons consent ----------------- */

function CcConsentSection() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyCcConsent);
  const setFn = useServerFn(setMyCcConsent);

  const { data, isLoading } = useQuery({
    queryKey: ["my-cc-consent"],
    queryFn: () => getFn(),
  });

  async function toggle(showReminder: boolean) {
    // "Show reminder" = ack is false. Toggle off = ack true (perma-consent).
    try {
      await setFn({ data: { ack: !showReminder } });
      qc.invalidateQueries({ queryKey: ["my-cc-consent"] });
      if (showReminder && typeof window !== "undefined") {
        // Clear the per-device dismissal so the dialog appears again.
        window.localStorage.removeItem("wi.cc_ack.v1");
      }
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    }
  }

  const showReminder = !(data?.ack ?? false);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
        Lounge rights
      </div>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">
            Show the Creative Commons reminder when I enter a Lounge
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Lounge contributions are shared under{" "}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-ink"
            >
              CC BY-SA 4.0
            </a>{" "}
            until a riff becomes a Collab, where co-creators set the terms. We show a
            one-time notice the first time you enter a Lounge; turn it back on if you
            want to see it again.
          </p>
        </div>
        <Switch
          checked={showReminder}
          disabled={isLoading}
          onCheckedChange={toggle}
          aria-label="Show Creative Commons reminder"
        />
      </div>
    </div>
  );
}

function ToggleCard({
  label,
  description,
  checked,
  loading,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  loading?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-4">
      <div className="flex-1">
        <Label className="text-sm font-medium text-ink">{label}</Label>
        <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={loading}
        onCheckedChange={(v) => onChange(!!v)}
        className="mt-0.5"
      />
    </div>
  );
}

/* ----------------- Blocked ----------------- */

type BlockedRow = {
  blocked_user_id: string;
  created_at: string;
  profiles: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

function BlockedSection() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-blocks", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<BlockedRow[]> => {
      if (!user) return [];
      const { data: blocks } = await supabase
        .from("user_blocks")
        .select("blocked_user_id, created_at")
        .eq("blocker_user_id", user.id)
        .order("created_at", { ascending: false });
      const ids = (blocks ?? []).map((b) => b.blocked_user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", ids);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      return (blocks ?? []).map((b) => ({
        blocked_user_id: b.blocked_user_id,
        created_at: b.created_at,
        profiles: byId.get(b.blocked_user_id) ?? null,
      }));
    },
  });

  async function unblock(id: string) {
    if (!user) return;
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_user_id", user.id)
      .eq("blocked_user_id", id);
    if (error) return toast.error(error.message);
    toast.success("Unblocked");
    qc.invalidateQueries({ queryKey: ["my-blocks"] });
    qc.invalidateQueries({ queryKey: ["blocked-ids"] });
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
        <p className="font-medium text-ink">You haven't blocked anyone.</p>
        <p className="mt-1 text-sm text-ink-muted">
          You can block someone from their profile at any time.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
      {data.map((row) => {
        const p = row.profiles;
        const name = p?.display_name || p?.username || "Unknown user";
        const initial = name.slice(0, 1).toUpperCase();
        return (
          <li key={row.blocked_user_id} className="flex items-center gap-3 p-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={p?.avatar_url ?? undefined} />
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{name}</div>
              {p?.username && (
                <div className="truncate text-xs text-ink-muted">@{p.username}</div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-1.5"
              onClick={() => unblock(row.blocked_user_id)}
            >
              <Ban className="h-3.5 w-3.5" /> Unblock
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/* ----------------- Danger zone ----------------- */

function DangerSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const deleteFn = useServerFn(deleteMyAccount);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const canSubmit = confirm === "DELETE" && !busy;

  const memo = useMemo(
    () => ({
      email: user?.email,
    }),
    [user?.email],
  );

  async function performDelete() {
    setBusy(true);
    try {
      await deleteFn({ data: { confirm: "DELETE" } });
      await supabase.auth.signOut();
      toast.success("Account deleted.");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete account.");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
      <p className="text-sm text-ink">
        Deleting your account immediately signs you out, scrubs your profile, hides your gallery
        and collab posts, and removes you from search. This can't be undone.
      </p>
      <Button
        variant="destructive"
        size="sm"
        className="mt-3 rounded-full"
        onClick={() => setOpen(true)}
      >
        Delete my account
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your Galleryhop account?</DialogTitle>
            <DialogDescription>
              {memo.email
                ? <>This permanently deletes <span className="font-medium text-ink">{memo.email}</span> and signs you out everywhere.</>
                : "This permanently deletes your account and signs you out everywhere."}
              {" "}Type <span className="font-mono font-semibold">DELETE</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            className="font-mono"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={!canSubmit} onClick={performDelete}>
              {busy ? "Deleting…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------- Notifications ----------------- */

const NOTIF_GROUPS: { key: string; label: string; description: string; email: NotifPrefKey; inapp: NotifPrefKey }[] = [
  { key: "messages", label: "Direct messages", description: "When someone sends you a DM.", email: "email_messages", inapp: "inapp_messages" },
  { key: "collab", label: "Collab activity", description: "Applications, replies, and updates on your collab posts.", email: "email_collab_activity", inapp: "inapp_collab_activity" },
  { key: "workshop", label: "Lounge updates", description: "Check-in reminders, status changes, and host announcements.", email: "email_workshop_updates", inapp: "inapp_workshop_updates" },
  { key: "follows", label: "New followers", description: "When someone follows your profile.", email: "email_follows", inapp: "inapp_follows" },
  { key: "credits", label: "Credit requests", description: "When someone credits you on a work, or asks you to confirm one.", email: "email_credits", inapp: "inapp_credits" },
  { key: "friend_online", label: "Someone in your network comes online", description: "When a mutual follow becomes active after being away. Off by default — turn on if you want to know.", email: "email_friend_online", inapp: "inapp_friend_online" },
];

function NotificationsSection() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyNotifPrefs);
  const setFn = useServerFn(updateMyNotifPrefs);
  const { data: prefs, isLoading } = useQuery({
    queryKey: ["my-notif-prefs"],
    queryFn: () => getFn(),
  });

  async function toggle(key: NotifPrefKey, value: boolean) {
    try {
      await setFn({ data: { [key]: value } as Partial<NotifPrefs> });
      qc.invalidateQueries({ queryKey: ["my-notif-prefs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    }
  }

  if (isLoading || !prefs) {
    return <div className="h-48 animate-pulse rounded-2xl bg-surface-2" />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="grid grid-cols-[1fr_72px_72px] items-center gap-3 border-b border-border px-4 py-2 text-xs uppercase tracking-wide text-ink-muted">
        <div>Activity</div>
        <div className="text-center">Email</div>
        <div className="text-center">In-app</div>
      </div>
      {NOTIF_GROUPS.map((g) => (
        <div
          key={g.key}
          className="grid grid-cols-[1fr_72px_72px] items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0"
        >
          <div>
            <div className="text-sm font-medium text-ink">{g.label}</div>
            <div className="text-xs text-ink-muted">{g.description}</div>
          </div>
          <div className="flex justify-center">
            <Switch checked={prefs[g.email]} onCheckedChange={(v) => toggle(g.email, !!v)} />
          </div>
          <div className="flex justify-center">
            <Switch checked={prefs[g.inapp]} onCheckedChange={(v) => toggle(g.inapp, !!v)} />
          </div>
        </div>
      ))}
      <div className="grid grid-cols-[1fr_72px_72px] items-center gap-3 px-4 py-3">
        <div>
          <div className="text-sm font-medium text-ink">Product news</div>
          <div className="text-xs text-ink-muted">
            Occasional updates about new features and Workshop happenings.
          </div>
        </div>
        <div className="flex justify-center">
          <Switch checked={prefs.email_product_news} onCheckedChange={(v) => toggle("email_product_news", !!v)} />
        </div>
        <div />
      </div>
    </div>
  );
}

/* ----------------- Reports ----------------- */

type ReportRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  description: string | null;
  status: "open" | "reviewed" | "dismissed" | "action_taken";
  created_at: string;
};

function ReportsSection() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["my-reports", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ReportRow[]> => {
      if (!user) return [];
      const { data: rows, error } = await supabase
        .from("reports")
        .select("id,entity_type,entity_id,reason,description,status,created_at")
        .eq("reporter_user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (rows ?? []) as ReportRow[];
    },
  });

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
        <p className="font-medium text-ink">No reports filed.</p>
        <p className="mt-1 text-sm text-ink-muted">
          If you ever need to flag something, use Report from any profile, work, or collab post.
        </p>
      </div>
    );
  }

  const statusLabel: Record<ReportRow["status"], string> = {
    open: "Under review",
    reviewed: "Reviewed",
    dismissed: "Dismissed",
    action_taken: "Action taken",
  };
  const statusTone: Record<ReportRow["status"], string> = {
    open: "bg-muted text-ink-soft",
    reviewed: "bg-muted text-ink-soft",
    dismissed: "bg-muted text-ink-muted",
    action_taken: "bg-emerald-100 text-emerald-900",
  };

  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
      {data.map((r) => (
        <li key={r.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink">
                {r.reason} <span className="text-ink-muted">· {r.entity_type}</span>
              </div>
              {r.description && (
                <div className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{r.description}</div>
              )}
              <div className="mt-1 text-xs text-ink-muted">
                Filed {new Date(r.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
              </div>
            </div>
            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", statusTone[r.status])}>
              {statusLabel[r.status]}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ----------------- Data export ----------------- */

function DataSection() {
  const exportFn = useServerFn(exportMyData);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const payload = await exportFn();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `workshop-data-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Your data is downloading.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export data.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm text-ink">
        Download a JSON snapshot of your profile, works, collab posts, Lounges, applications,
        comments, follows, blocks, and reports filed. Useful for keeping a personal backup or
        moving your portfolio elsewhere.
      </p>
      <Button size="sm" variant="outline" className="mt-3 rounded-full gap-1.5" onClick={download} disabled={busy}>
        <Download className="h-3.5 w-3.5" /> {busy ? "Preparing…" : "Download my data"}
      </Button>
      <p className="mt-3 text-xs text-ink-muted">
        Media files (images, video) are referenced by URL, not embedded.
      </p>
    </div>
  );
}

