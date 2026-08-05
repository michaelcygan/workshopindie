import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAccountLifecycle } from "./provider";
import {
  consumePostAuthIntent,
  migrateLegacyIntents,
  peekPostAuthIntent,
  clearPostAuthIntent,
} from "@/lib/post-auth-intent";
import { safeDestinationOrHome } from "@/lib/safe-destination";
import { rsvp } from "@/lib/group-events.functions";
import { joinGroup } from "@/lib/groups.functions";
import { redeemGroupSeedLink } from "@/lib/group-seed-links.functions";
import { attributeReferral, setReferredBy } from "@/lib/share.functions";
import { toast } from "sonner";

const REF_KEY = "signup-ref";

/**
 * Routes a first-run account to the member homepage, then — once the lifecycle
 * is READY — runs whatever the person was trying to do before they signed up.
 *
 * Nothing here fires on bare SIGNED_IN: the lifecycle gate must clear first.
 */
export function PostAuthRunner() {
  const { state, isReady, userId } = useAccountLifecycle();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const rsvpFn = useServerFn(rsvp);
  const joinGroupFn = useServerFn(joinGroup);
  const redeemSeed = useServerFn(redeemGroupSeedLink);
  const lookupRef = useServerFn(attributeReferral);
  const writeRef = useServerFn(setReferredBy);

  const ranFor = useRef<string | null>(null);
  const referralFor = useRef<string | null>(null);

  // Reset per-account guards on user switch.
  useEffect(() => {
    ranFor.current = null;
    referralFor.current = null;
  }, [userId]);

  // Pull any pre-existing one-off pending values into the unified intent.
  useEffect(() => {
    migrateLegacyIntents();
  }, []);

  // Homepage-first: lifecycle work always happens over the member homepage.
  useEffect(() => {
    if (state !== "age_required" && state !== "welcome_required") return;
    if (pathname === "/") return;
    // Keep where they were, so it can be resumed once the lifecycle is ready.
    if (!peekPostAuthIntent()) {
      const current = `${pathname}${typeof window !== "undefined" ? window.location.search : ""}`;
      if (pathname !== "/login" && pathname !== "/signup" && pathname !== "/auth/complete") {
        try {
          sessionStorage.setItem(
            "ws.postAuthIntent.v1",
            JSON.stringify({
              v: 1,
              kind: "return_to",
              payload: {},
              returnTo: safeDestinationOrHome(current),
              createdAt: Date.now(),
              expiresAt: Date.now() + 30 * 60 * 1000,
            }),
          );
        } catch {
          /* ignore */
        }
      }
    }
    navigate({ to: "/", replace: true });
  }, [state, pathname, navigate]);

  // Referral attribution (moved out of /onboarding) — idempotent, once per user.
  useEffect(() => {
    if (!isReady || !userId) return;
    if (referralFor.current === userId) return;
    referralFor.current = userId;
    let ref: string | null = null;
    try {
      ref = sessionStorage.getItem(REF_KEY);
    } catch {
      ref = null;
    }
    if (!ref) return;
    (async () => {
      try {
        const r = await lookupRef({ data: { referrerUsername: ref! } });
        if (r.ok && r.referrerId) {
          await writeRef({ data: { userId, referrerId: r.referrerId } });
        }
        // Attributed, or confirmed non-match — either way it's resolved.
        sessionStorage.removeItem(REF_KEY);
      } catch {
        // Keep it for a later attempt.
        referralFor.current = null;
      }
    })();
  }, [isReady, userId, lookupRef, writeRef]);

  // Resume the originating action.
  useEffect(() => {
    if (!isReady || !userId) return;
    if (ranFor.current === userId) return;
    const pending = peekPostAuthIntent();
    if (!pending) return;
    ranFor.current = userId;

    (async () => {
      try {
        const executed = await consumePostAuthIntent(userId, async (intent) => {
          switch (intent.kind) {
            case "event_rsvp": {
              const status = intent.payload.status as "going" | "maybe" | "declined";
              await rsvpFn({ data: { event_id: intent.payload.event_id!, status } });
              toast.success("You're in!");
              qc.invalidateQueries({ queryKey: ["event"] });
              return;
            }
            case "group_seed_join": {
              await redeemSeed({ data: { token: intent.payload.token! } });
              qc.invalidateQueries({ queryKey: ["my-group-ids"] });
              return;
            }
            case "group_join": {
              await joinGroupFn({ data: { groupId: intent.payload.groupId! } });
              qc.invalidateQueries({ queryKey: ["my-group-ids"] });
              return;
            }
            default:
              // Navigation-only intents (follow / like / save / claim / invite):
              // the destination surface owns the action once signed in.
              return;
          }
        });
        if (executed) {
          const dest = safeDestinationOrHome(executed.returnTo);
          if (dest !== "/" || window.location.pathname !== "/") {
            window.location.assign(dest);
          }
        }
      } catch (err) {
        // Recoverable: the intent is retained so a retry is possible.
        ranFor.current = null;
        toast.error(err instanceof Error ? err.message : "We couldn't finish that — try again.");
      }
    })();
  }, [isReady, userId, rsvpFn, joinGroupFn, redeemSeed, qc]);

  return null;
}

/** Drop tab-scoped auth intents on a deliberate sign-out. */
export function clearPendingAuthState() {
  clearPostAuthIntent();
  try {
    sessionStorage.removeItem(REF_KEY);
  } catch {
    /* ignore */
  }
}
