import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Users, PenLine, Megaphone, ArrowRight } from "lucide-react";
import { useAccountLifecycle } from "./provider";
import { supabase } from "@/integrations/supabase/client";
import { requestAccountDeletion } from "@/lib/account-deletion.functions";
import { clearPostAuthIntent } from "@/lib/post-auth-intent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/**
 * The single first-run overlay. Exactly one stage renders at a time, in a
 * mandatory order: age → welcome. Nothing here reads `profiles.onboarded`.
 */
export function AccountLifecycleGate() {
  const { state } = useAccountLifecycle();
  if (state === "signed_out" || state === "loading" || state === "ready") return null;
  return (
    <Shell>
      {state === "age_required" && <AgeStage />}
      {state === "underage_removal" && <UnderageStage />}
      {state === "welcome_required" && <WelcomeStage />}
      {state === "load_error" && <LoadErrorStage />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-background/85 px-4 py-6 backdrop-blur-sm sm:items-center"
    >
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className="w-full max-w-lg rounded-t-3xl border border-border bg-surface p-6 shadow-soft sm:rounded-xl sm:p-8"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

async function hardSignOut(qc: ReturnType<typeof useQueryClient>) {
  clearPostAuthIntent();
  await qc.cancelQueries();
  qc.clear();
  await supabase.auth.signOut();
}

/* ------------------------------------------------------------------ age --- */

function AgeStage() {
  const { submitBirthdate } = useAccountLifecycle();
  const [birthdate, setBirthdate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A real date range: the DB's 18+ guard makes the decision, not the input.
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!birthdate) return;
    if (birthdate < "1900-01-01" || birthdate > today) {
      setError("Please enter a real date of birth.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await submitBirthdate(birthdate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that just now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h2 className="font-display text-2xl text-ink">First, confirm you're 18+</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Workshop is for adults. Your birth date stays private and never appears on your profile.
      </p>
      <form onSubmit={onConfirm} className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="lifecycle-dob">Date of birth</Label>
          <Input
            id="lifecycle-dob"
            type="date"
            required
            min="1900-01-01"
            max={today}
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <Button type="submit" className="w-full rounded-md" disabled={submitting || !birthdate}>
          {submitting ? "Saving…" : "Confirm"}
        </Button>
        <p className="text-center text-xs text-ink-muted">
          By confirming you attest that you are at least 18 years old.
        </p>
      </form>
    </>
  );
}

/* -------------------------------------------------------------- underage --- */

function UnderageStage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const deleteAccount = useServerFn(requestAccountDeletion);
  const [submitting, setSubmitting] = useState(false);

  async function onAcceptDeletion() {
    setSubmitting(true);
    try {
      await deleteAccount();
      await hardSignOut(qc);
      navigate({ to: "/goodbye", replace: true });
    } catch (err) {
      setSubmitting(false);
      toast.error(err instanceof Error ? err.message : "Couldn't complete that just now.");
    }
  }

  return (
    <>
      <h2 className="font-display text-2xl text-ink">Workshop is 18+</h2>
      <p className="mt-2 text-sm text-ink-muted">
        We can't keep your account active. We won't share or sell your data — your profile will be
        removed. You have 30 days to sign back in and cancel the deletion.
      </p>
      <div className="mt-5 space-y-2">
        <Button
          type="button"
          onClick={onAcceptDeletion}
          disabled={submitting}
          className="w-full rounded-full"
        >
          {submitting ? "Removing…" : "Remove my account"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={async () => {
            await hardSignOut(qc);
            navigate({ to: "/", replace: true });
          }}
          className="w-full rounded-full"
        >
          Sign out
        </Button>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- welcome --- */

type WelcomeChoice = {
  id: "profile" | "group" | "post" | "collab";
  icon: React.ReactNode;
  title: string;
  body: string;
};

const CHOICES: WelcomeChoice[] = [
  {
    id: "profile",
    icon: <Upload className="h-4 w-4" />,
    title: "Build your profile",
    body: "Add a photo and a line about your work, then publish your first Work.",
  },
  {
    id: "group",
    icon: <Users className="h-4 w-4" />,
    title: "Find a Group",
    body: "Join a city, scene, genre, or creative community.",
  },
  {
    id: "post",
    icon: <PenLine className="h-4 w-4" />,
    title: "Write a post",
    body: "Share your process, context, stories, or ideas from your practice.",
  },
  {
    id: "collab",
    icon: <Megaphone className="h-4 w-4" />,
    title: "Post a Collab",
    body: "Put out a call for the people or skills your project needs.",
  },
];

function WelcomeStage() {
  const { completeWelcome } = useAccountLifecycle();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(id: WelcomeChoice["id"] | "explore") {
    setBusy(id);
    setError(null);
    try {
      // Persist first — never navigate on an unconfirmed write.
      await completeWelcome();
    } catch {
      setBusy(null);
      setError("We couldn't save that. Try again.");
      return;
    }
    setBusy(null);
    switch (id) {
      case "profile":
        navigate({ to: "/me/edit", search: { next: "/works/new" } });
        return;
      case "group":
        navigate({ to: "/groups" });
        return;
      case "post":
        navigate({ to: "/me/blog" });
        return;
      case "collab":
        navigate({ to: "/collab/new" });
        return;
      default:
        return; // Explore Workshop — stay on the member homepage.
    }
  }

  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
        Welcome to Workshop
      </p>
      <h2 className="mt-1 font-display text-2xl text-ink">Make something. Find your people.</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Workshop is an independent creative network: publish what you make, write about the process,
        find your scene, and build the next thing with other people.
      </p>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {CHOICES.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={!!busy}
            onClick={() => choose(c.id)}
            className="group flex w-full items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition hover:border-ink/20 hover:shadow-soft disabled:opacity-60"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-ink ring-1 ring-border">
              {c.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">{c.title}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{c.body}</span>
            </span>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-center text-xs text-destructive">{error}</p>}

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => choose("explore")}
          className="text-xs text-ink-muted hover:text-ink disabled:opacity-60"
        >
          {busy === "explore" ? "One sec…" : "Explore Workshop"}
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ load error --- */

function LoadErrorStage() {
  const { refresh } = useAccountLifecycle();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  return (
    <>
      <h2 className="font-display text-2xl text-ink">We couldn't finish opening your account</h2>
      <p className="mt-2 text-sm text-ink-muted">
        You're still signed in — this is on our side. Try again, or sign out and come back.
      </p>
      <div className="mt-5 space-y-2">
        <Button
          type="button"
          className="w-full rounded-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await refresh();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Retrying…" : "Retry"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-full"
          disabled={busy}
          onClick={async () => {
            await hardSignOut(qc);
            navigate({ to: "/", replace: true });
          }}
        >
          Sign out
        </Button>
      </div>
    </>
  );
}
