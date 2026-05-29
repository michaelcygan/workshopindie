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
  Flag,
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

type SectionId = "account" | "plus" | "privacy" | "blocked" | "danger";
const SECTIONS: { id: SectionId; label: string; icon: typeof UserIcon }[] = [
  { id: "account", label: "Account", icon: UserIcon },
  { id: "plus", label: "Plus membership", icon: Sparkles },
  { id: "privacy", label: "Privacy", icon: Lock },
  { id: "blocked", label: "Blocked users", icon: Ban },
  { id: "danger", label: "Delete account", icon: ShieldAlert },
];

function SettingsPage() {
  const [active, setActive] = useState<SectionId>("account");
  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
    account: null,
    plus: null,
    privacy: null,
    blocked: null,
    danger: null,
  });

  // Honor #hash on first paint
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
    if (hash && SECTIONS.some((s) => s.id === hash)) {
      const id = hash as SectionId;
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

          <Section id="plus" title="Plus membership" subtitle="Manage your Workshop Plus subscription." refMap={sectionRefs}>
            <PlusSection />
          </Section>

          <Section id="privacy" title="Privacy" subtitle="Control who can reach you and how you appear." refMap={sectionRefs}>
            <PrivacySection />
          </Section>

          <Section id="blocked" title="Blocked users" subtitle="People you've blocked don't see your content and can't contact you." refMap={sectionRefs}>
            <BlockedSection />
          </Section>

          <Section id="danger" title="Delete account" subtitle="Permanent and immediate. This can't be undone." refMap={sectionRefs}>
            <DangerSection />
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

function AccountSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);

  const ageFieldsFn = useServerFn(getMyAgeFields);
  const { data: ageInfo } = useQuery({
    queryKey: ["my-age-fields"],
    queryFn: () => ageFieldsFn(),
  });

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

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <Row label="Email" icon={Mail}>
        <span className="truncate text-sm text-ink">{user?.email ?? "—"}</span>
      </Row>
      <Row label="Password" icon={KeyRound}>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={resetting}
          onClick={sendPasswordReset}
        >
          {resetting ? "Sending…" : "Send reset link"}
        </Button>
      </Row>
      <Row label="Date of birth" icon={UserIcon}>
        <span className="text-sm text-ink">
          {ageInfo?.birthdate ?? <span className="text-ink-muted">Not set — </span>}
          {!ageInfo?.birthdate && (
            <Link to="/me/edit" className="text-sm underline underline-offset-2">
              add it on Edit profile
            </Link>
          )}
        </span>
      </Row>
      <div className="pt-2">
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>
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

  async function update(patch: { dmPolicy?: "everyone" | "nobody"; discoverable?: boolean; indexable?: boolean }) {
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

  return (
    <div className="space-y-4">
      {/* DMs */}
      <ToggleCard
        label="Allow direct messages"
        description="When off, no one can start a new conversation with you. Existing threads still work."
        loading={pLoading}
        checked={privacy?.dmPolicy !== "nobody"}
        onChange={(on) => update({ dmPolicy: on ? "everyone" : "nobody" })}
      />

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

      {/* Age filter */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label className="text-sm font-medium text-ink">Workshops age filter</Label>
            <p className="mt-0.5 text-xs text-ink-muted">
              Only show Workshops scoped to this minimum age. Private to you.
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
        Deleting your account immediately signs you out, scrubs your profile, hides your works
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
            <DialogTitle>Delete your Workshop account?</DialogTitle>
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
