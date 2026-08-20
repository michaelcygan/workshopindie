import { useState } from "react";
import { startOAuth } from "@/lib/auth-launcher";
import type { NewPostAuthIntent } from "@/lib/post-auth-intent";
import { goToAuthCallback } from "@/lib/auth-launcher";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function GoogleSignIn({
  label = "Continue with Google",
  redirectTo,
  intent,
  className,
}: {
  label?: string;
  /** Same-origin path to return to once the account lifecycle is ready. */
  redirectTo?: string;
  /** Richer originating action (RSVP, join, claim…) to resume after auth. */
  intent?: NewPostAuthIntent;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const result = await startOAuth("google", { intent, returnTo: redirectTo ?? null });
    if (result.status === "error") {
      toast.error(result.message);
      setLoading(false);
      return;
    }
    if (result.status === "redirected") return; // browser is leaving
    goToAuthCallback();
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
      className={cn("w-full rounded-full", className)}
    >
      <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
      </svg>
      {loading ? "Opening Google…" : label}
    </Button>
  );
}
