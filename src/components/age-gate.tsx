import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getMyAgeFields, setMyBirthdate } from "@/lib/profile-age.functions";
import { requestAccountDeletion } from "@/lib/account-deletion.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/**
 * Forces every signed-in user to confirm their date of birth. Workshop is 18+.
 * - No birthdate on file → blocking modal asks for one.
 * - ≥18 → saves and dismisses.
 * - <18 → swaps to a "we have to remove your account" state and soft-deletes
 *   the profile, then signs them out and routes to /goodbye.
 *
 * Public/signed-out users see nothing. The modal is not dismissible — there is
 * no escape hatch other than entering a valid 18+ date or accepting deletion.
 */
export function AgeGate() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchAge = useServerFn(getMyAgeFields);
  const saveDob = useServerFn(setMyBirthdate);
  const deleteAccount = useServerFn(requestAccountDeletion);

  const [needsDob, setNeedsDob] = useState(false);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState<"ask" | "underage">("ask");
  const [birthdate, setBirthdate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Max date input value = today − 18y (under-18 literally can't pick a valid value).
  const maxDob = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    if (loading || !user) {
      setChecking(false);
      setNeedsDob(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    fetchAge()
      .then((r) => {
        if (cancelled) return;
        setNeedsDob(!r.birthdate);
      })
      .catch(() => {
        // If the lookup fails we don't block the app — better to fail open than
        // lock everyone out on a transient error. Will retry next mount.
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading, fetchAge]);

  if (!user || loading || checking || !needsDob) return null;

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!birthdate) return;
    setSubmitting(true);
    try {
      await saveDob({ data: { birthdate } });
      // Saved → ≥18 (trigger enforces). Done.
      setNeedsDob(false);
      toast.success("Thanks — you're all set.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // The DB trigger speaks for under-18: "Workshop is an 18+ product."
      if (/18\+/.test(msg)) {
        setView("underage");
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onAcceptDeletion() {
    setSubmitting(true);
    try {
      await deleteAccount();
      await supabase.auth.signOut();
      navigate({ to: "/goodbye", replace: true });
    } catch (err) {
      setSubmitting(false);
      toast.error(err instanceof Error ? err.message : "Couldn't complete that just now.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-soft sm:p-8">
        {view === "ask" ? (
          <>
            <h2 id="age-gate-title" className="font-display text-2xl text-ink">
              One more thing
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Workshop is now an 18+ product. Confirm your date of birth to keep using your account.
              This is private — it never appears on your profile.
            </p>
            <form onSubmit={onConfirm} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="age-gate-dob">Date of birth</Label>
                <Input
                  id="age-gate-dob"
                  type="date"
                  required
                  max={maxDob}
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full rounded-full"
                disabled={submitting || !birthdate}
              >
                {submitting ? "Saving…" : "Confirm"}
              </Button>
              <p className="text-center text-xs text-ink-muted">
                By confirming you attest that you are at least 18 years old.
              </p>
            </form>
          </>
        ) : (
          <>
            <h2 id="age-gate-title" className="font-display text-2xl text-ink">
              Workshop is 18+
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              We can't keep your account active. We won't share or sell your data — your profile
              will be removed. You have 30 days to sign back in and cancel the deletion.
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
                onClick={() => setView("ask")}
                disabled={submitting}
                className="w-full rounded-full"
              >
                Back
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
