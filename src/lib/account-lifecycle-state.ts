/**
 * Pure account-lifecycle state machine. No React, no network — unit tested.
 *
 * Three independent pieces of profile state drive first-run:
 *   birthdate         → age confirmed (mandatory, 18+ enforced by the DB)
 *   tour_completed_at → welcome introduction seen
 *   onboarded         → public profile completed (OPTIONAL, never gates)
 *
 * Order is mandatory: age_required always resolves before welcome_required.
 */

export type AccountLifecycleState =
  | "signed_out"
  | "loading"
  | "load_error"
  | "age_required"
  | "welcome_required"
  | "ready"
  | "underage_removal";

export type LifecycleFacts = {
  hasBirthdate: boolean;
  welcomeCompleted: boolean;
  profileCompleted: boolean;
  profileExists: boolean;
};

export type LifecycleInput = {
  /** Auth resolved and a user is present. */
  isAuthenticated: boolean;
  /** Auth provider still resolving the session. */
  authLoading: boolean;
  /** Lifecycle facts query state. */
  queryStatus: "idle" | "loading" | "error" | "success";
  facts?: LifecycleFacts | null;
  /** Set once the server rejects a submitted birthdate as under 18. */
  underage?: boolean;
};

export function deriveLifecycleState(input: LifecycleInput): AccountLifecycleState {
  if (input.authLoading) return "loading";
  if (!input.isAuthenticated) return "signed_out";
  if (input.underage) return "underage_removal";
  if (input.queryStatus === "error") return "load_error";
  if (input.queryStatus !== "success" || !input.facts) return "loading";

  const facts = input.facts;
  // A missing profile row is NOT "ready" — it needs repair, never a silent bypass.
  if (!facts.profileExists) return "load_error";
  if (!facts.hasBirthdate) return "age_required";
  if (!facts.welcomeCompleted) return "welcome_required";
  return "ready";
}

/** True when an overlay must block the signed-in product. */
export function lifecycleBlocks(state: AccountLifecycleState): boolean {
  return state === "age_required" || state === "welcome_required" || state === "underage_removal" || state === "load_error";
}
