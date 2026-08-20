import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import {
  getAccountLifecycle,
  ensureProfileRow,
  completeWelcome as completeWelcomeFn,
} from "@/lib/account-lifecycle.functions";
import { confirmAdultAttestation } from "@/lib/profile-age.functions";
import {
  clearPendingAdultAttestation,
  hasPendingAdultAttestation,
} from "@/lib/adult-attestation";
import {
  deriveLifecycleState,
  type AccountLifecycleState,
  type LifecycleFacts,
} from "@/lib/account-lifecycle-state";

type Ctx = {
  state: AccountLifecycleState;
  facts: LifecycleFacts | null;
  userId: string | null;
  /** True once the account may use the signed-in product. */
  isReady: boolean;
  refresh: () => Promise<void>;
  /** Records the 18+ attestation. */
  confirmAdult: () => Promise<void>;
  /** Member declared they are under 18 — moves to the removal stage. */
  declineAdult: () => void;
  completeWelcome: () => Promise<void>;
};

const LifecycleCtx = createContext<Ctx>({
  state: "signed_out",
  facts: null,
  userId: null,
  isReady: false,
  refresh: async () => {},
  confirmAdult: async () => {},
  declineAdult: () => {},
  completeWelcome: async () => {},
});

export const useAccountLifecycle = () => useContext(LifecycleCtx);

export function AccountLifecycleProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();

  const fetchLifecycle = useServerFn(getAccountLifecycle);
  const repairProfile = useServerFn(ensureProfileRow);
  const attestAdult = useServerFn(confirmAdultAttestation);
  const markWelcome = useServerFn(completeWelcomeFn);

  const [underage, setUnderage] = useState(false);
  const repairedFor = useRef<string | null>(null);

  // Reset all per-account state when the signed-in user changes.
  useEffect(() => {
    setUnderage(false);
    repairedFor.current = null;
  }, [userId]);

  const query = useQuery({
    queryKey: ["account-lifecycle", userId],
    enabled: !!userId && !authLoading,
    staleTime: 30_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    queryFn: async (): Promise<LifecycleFacts> => {
      const facts = await fetchLifecycle();
      // Auth session can land before the profile trigger is visible. Repair
      // once per account, then re-read. Never treat "missing" as ready.
      if (!facts.profileExists && repairedFor.current !== userId) {
        repairedFor.current = userId;
        await repairProfile();
        return await fetchLifecycle();
      }
      return facts;
    },
  });

  const queryStatus: "idle" | "loading" | "error" | "success" = !userId
    ? "idle"
    : query.isError
      ? "error"
      : query.data
        ? "success"
        : "loading";

  const state = deriveLifecycleState({
    isAuthenticated: !!userId,
    authLoading,
    queryStatus,
    facts: query.data ?? null,
    underage,
  });

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["account-lifecycle", userId] });
    await query.refetch();
  }, [qc, query, userId]);

  const confirmAdult = useCallback(async () => {
    await attestAdult({ data: { confirmed: true } });
    await refresh();
  }, [attestAdult, refresh]);

  // Signup surfaces collect the 18+ checkbox before the session exists (email
  // confirm / OAuth round-trips). Stamp it as soon as we have a session so the
  // member isn't asked the same question twice.
  const stampedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || !query.data || query.data.adultConfirmed) return;
    if (stampedFor.current === userId) return;
    if (!hasPendingAdultAttestation()) return;
    stampedFor.current = userId;
    void (async () => {
      try {
        await attestAdult({ data: { confirmed: true } });
        clearPendingAdultAttestation();
        await refresh();
      } catch {
        /* the first-run gate will ask directly */
      }
    })();
  }, [userId, query.data, attestAdult, refresh]);

  const declineAdult = useCallback(() => {
    setUnderage(true);
  }, []);

  const completeWelcome = useCallback(async () => {
    await markWelcome();
    await refresh();
  }, [markWelcome, refresh]);

  const value = useMemo<Ctx>(
    () => ({
      state,
      facts: query.data ?? null,
      userId,
      isReady: state === "ready",
      refresh,
      confirmAdult,
      declineAdult,
      completeWelcome,
    }),
    [state, query.data, userId, refresh, confirmAdult, declineAdult, completeWelcome],
  );

  return <LifecycleCtx.Provider value={value}>{children}</LifecycleCtx.Provider>;
}
