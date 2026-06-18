import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignIn } from "@/components/google-sign-in";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  onAuthed?: () => void;
};

/**
 * Reusable "create your free account to continue" gate. Wraps email/password
 * signup + Google. On successful signup, calls onAuthed(). emailRedirectTo
 * is the current URL so confirm-flow lands the user right back here.
 */
export function SignupGateModal({ open, onOpenChange, title, subtitle, onAuthed }: Props) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const redirect = typeof window !== "undefined" ? window.location.href : undefined;
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {title ?? "Create your free account"}
          </DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          <GoogleSignIn label={mode === "signup" ? "Sign up with Google" : "Continue with Google"} />
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-ink-muted">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="gate-email">Email</Label>
              <Input id="gate-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gate-password">Password</Label>
              <Input id="gate-password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-full">
              {loading ? "…" : mode === "signup" ? "Create account & join" : "Sign in & join"}
            </Button>
          </form>
          <p className="text-center text-sm text-ink-muted">
            {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
            <button
              type="button"
              className="text-ink underline-offset-2 hover:underline"
              onClick={() => setMode((m) => (m === "signup" ? "signin" : "signup"))}
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
