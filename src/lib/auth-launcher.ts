/**
 * The one place the app starts an OAuth round trip.
 *
 * - Persists the user's originating intent BEFORE leaving the page, so a full
 *   provider redirect can't lose it.
 * - Always returns the provider to the dedicated same-origin callback route,
 *   never to the final destination (which may be protected or unsafe).
 *
 * The generated wrapper (`src/integrations/lovable/index.ts`) is untouched.
 */
import { lovable } from "@/integrations/lovable/index";
import { setPostAuthIntent, type NewPostAuthIntent } from "./post-auth-intent";
import { safeDestination } from "./safe-destination";

export const AUTH_CALLBACK_PATH = "/auth/complete";

export function authCallbackUrl(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return origin + AUTH_CALLBACK_PATH;
}

export type OAuthProvider = "google" | "apple";

export type StartOAuthResult =
  | { status: "redirected" }
  | { status: "session" }
  | { status: "error"; message: string };

export async function startOAuth(
  provider: OAuthProvider,
  opts?: { intent?: NewPostAuthIntent; returnTo?: string | null },
): Promise<StartOAuthResult> {
  // Persist intent first — the page may be gone a millisecond later.
  if (opts?.intent) {
    setPostAuthIntent(opts.intent);
  } else {
    const dest = safeDestination(opts?.returnTo);
    if (dest) setPostAuthIntent({ kind: "return_to", returnTo: dest });
  }

  try {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: authCallbackUrl(),
    });
    if (result.error) {
      return { status: "error", message: result.error.message ?? `${provider} sign-in failed` };
    }
    if (result.redirected) return { status: "redirected" };
    // Popup/web_message flow: the session is already set on this page.
    return { status: "session" };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : `${provider} sign-in failed`,
    };
  }
}

/** Where the browser should land after any successful auth on this page. */
export function goToAuthCallback() {
  if (typeof window !== "undefined") window.location.assign(AUTH_CALLBACK_PATH);
}
