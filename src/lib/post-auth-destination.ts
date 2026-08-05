import { supabase } from "@/integrations/supabase/client";

/**
 * Where should a just-signed-in user go?
 *
 * - An explicit same-origin destination (event RSVP, group invite, collab
 *   claim) always wins — those flows stash their own target.
 * - Otherwise: profile not onboarded → /onboarding, else the homepage.
 *
 * Shared by /login, /signup and the OAuth return path so Google, Apple and
 * email all behave identically.
 */
export function safePath(path?: string | null): string | null {
  return path && path.startsWith("/") && !path.startsWith("//") ? path : null;
}

export async function resolvePostAuthPath(preferred?: string | null): Promise<string> {
  const target = safePath(preferred);
  if (target) return target;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return "/";
    const { data } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", uid)
      .maybeSingle();
    return data?.onboarded ? "/" : "/onboarding";
  } catch {
    return "/";
  }
}

/** True when the signed-in user still needs to complete onboarding. */
export async function needsOnboarding(): Promise<boolean> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return false;
    const { data } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", uid)
      .maybeSingle();
    return !data?.onboarded;
  } catch {
    return false;
  }
}
