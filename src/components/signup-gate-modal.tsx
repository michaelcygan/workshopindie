import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignIn } from "@/components/google-sign-in";
import { AppleSignIn } from "@/components/apple-sign-in";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AUTH_CALLBACK_PATH } from "@/lib/auth-launcher";
import { AdultAttestationCheckbox } from "@/components/adult-attestation-checkbox";
import { rememberAdultAttestation } from "@/lib/adult-attestation";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  onAuthed?: () => void;
  /** Optional slot rendered under the sign-in/sign-up toggle. */
  footer?: React.ReactNode;
};

/**
 * Reusable "create your free account to continue" gate. Wraps email/password
 * signup + Google/Apple. On successful signup, calls onAuthed(). emailRedirectTo
 * is the current URL so confirm-flow lands the user right back here.
 */
export function SignupGateModal({ open, onOpenChange, title, subtitle, onAuthed, footer }: Props) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [adult, setAdult] = useState(false);
  const needsAdult = mode === "signup" && !adult;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsAdult) {
      toast.error("Please confirm that you are 18 or older.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const redirect =
          typeof window !== "undefined" ? `${window.location.origin}${AUTH_CALLBACK_PATH}` : undefined;
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirect },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Welcome!");
          onAuthed?.();
        } else {
          toast.success("Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
        onAuthed?.();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface p-6 shadow-lift sm:max-w-[440px] sm:p-8">
        <DialogHeader className="text-center">
          <DialogTitle className="font-display text-[28px] tracking-tight text-ink">
            {title ?? "Join Workshop"}
          </DialogTitle>
          {subtitle && (
            <DialogDescription className="text-[15px] leading-relaxed text-ink-soft">
              {subtitle}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-3">
          {mode === "signup" && (
            <AdultAttestationCheckbox
              id="gate-adult"
              checked={adult}
              onChange={(v) => {
                setAdult(v);
                if (v) rememberAdultAttestation();
              }}
              className="rounded-xl border border-border bg-surface-2 p-3"
            />
          )}
          <div className={needsAdult ? "pointer-events-none space-y-3 opacity-50" : "space-y-3"}>
          <GoogleSignIn
            label={mode === "signup" ? "Sign up with Google" : "Continue with Google"}
            redirectTo={typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined}
            className="rounded-full border border-signal bg-surface hover:bg-surface-2"
          />
          <AppleSignIn
            label={mode === "signup" ? "Sign up with Apple" : "Continue with Apple"}
            redirectTo={typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined}
            className="rounded-full border border-border bg-surface-2 hover:bg-surface"
          />
          </div>
          <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-widest text-ink-muted">
            <span className="h-px flex-1 bg-border" /> or{" "}
            <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gate-email" className="text-sm font-semibold text-ink-soft">
                Email
              </Label>
              <Input
                id="gate-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border-border bg-surface-2"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gate-password" className="text-sm font-semibold text-ink-soft">
                Password
              </Label>
              <Input
                id="gate-password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl border-border bg-surface-2"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || needsAdult}
              className="w-full rounded-xl bg-primary text-primary-foreground shadow-soft transition-transform active:scale-[0.98]"
            >
              {loading ? "…" : mode === "signup" ? "Create account & join" : "Sign in & join"}
            </Button>
          </form>
          <p className="text-center text-sm text-ink-muted">
            {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
            <button
              type="button"
              className="font-semibold text-ink underline-offset-2 hover:underline"
              onClick={() => setMode((m) => (m === "signup" ? "signin" : "signup"))}
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}
