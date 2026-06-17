import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { GoogleSignIn } from "@/components/google-sign-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { setPendingRsvp } from "@/hooks/use-pending-rsvp";

export function EventRsvpAuthSheet({
  open,
  onOpenChange,
  eventId,
  status,
  redirectTo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  status: "going" | "maybe" | "declined";
  redirectTo: string;
}) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  function persist() {
    setPendingRsvp({ event_id: eventId, status, redirect_to: redirectTo });
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    persist();
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${redirectTo}` },
        });
        if (error) throw error;
        toast.success("Check your email to confirm.");
        onOpenChange(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: redirectTo });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-border">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl">RSVP to join</SheetTitle>
          <SheetDescription>
            Takes 20 seconds. We'll lock in your spot the moment you're in.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-5 flex flex-col gap-3">
          <div onClick={persist}>
            <GoogleSignIn />
          </div>
          <p className="-mt-1 text-center text-[11px] text-ink-muted">
            We'll bring you back here right after.
          </p>
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="bg-background px-2 text-xs text-ink-muted">or with email</span></div>
          </div>
          <form onSubmit={handleEmail} className="flex flex-col gap-2">
            <Input type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            <Button type="submit" className="rounded-full" disabled={busy}>
              {mode === "signup" ? "Sign up & RSVP" : "Log in & RSVP"}
            </Button>
            <button
              type="button"
              onClick={() => setMode((m) => (m === "signup" ? "login" : "signup"))}
              className="text-xs text-ink-muted hover:text-ink"
            >
              {mode === "signup" ? "Already have an account? Log in" : "New here? Sign up"}
            </button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
