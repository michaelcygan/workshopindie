import { useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { resolvePostAuthPath, goToPostAuth } from "@/lib/post-auth-destination";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AppleSignIn({
  label = "Continue with Apple",
  redirectTo,
}: {
  label?: string;
  /** Same-origin path (must start with "/") to return to after Apple sign-in. */
  redirectTo?: string;
}) {
  const [loading, setLoading] = useState(false);
  const safeRedirect =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : null;

  const handleClick = async () => {
    setLoading(true);
    try {
      const returnUrl = safeRedirect ? window.location.origin + safeRedirect : window.location.origin;
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: returnUrl,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Apple sign-in failed");
        setLoading(false);
        return;
      }
      if (result.redirected) return; // browser will redirect
      goToPostAuth(await resolvePostAuthPath(safeRedirect));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apple sign-in failed");
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
      className="w-full rounded-full"
    >
      <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4 fill-current" aria-hidden>
        <path d="M16.365 1.43c0 1.14-.42 2.2-1.13 3.02-.85.98-2.23 1.74-3.36 1.65a3.6 3.6 0 0 1 1.16-2.94c.79-.86 2.17-1.53 3.33-1.61.01.03 0 .06 0 .09zM20.5 17.1c-.55 1.27-.82 1.83-1.53 2.95-.99 1.56-2.39 3.5-4.12 3.52-1.54.02-1.93-1-4.02-.99-2.09.01-2.52 1.01-4.06.99-1.73-.02-3.06-1.78-4.05-3.33C-.06 15.9-.35 10.79 1.35 8.07c1.2-1.93 3.1-3.06 4.89-3.06 1.82 0 2.96 1 4.47 1 1.46 0 2.35-1 4.46-1 1.59 0 3.28.87 4.48 2.37-3.94 2.16-3.3 7.79 1.85 9.72z" />
      </svg>
      {loading ? "Opening Apple…" : label}
    </Button>
  );
}
