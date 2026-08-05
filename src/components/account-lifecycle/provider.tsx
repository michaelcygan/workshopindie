import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import {
  getAccountLifecycle,
  ensureProfileRow,
  completeWelcome as completeWelcomeFn,
} from "@/lib/account-lifecycle.functions";
import { setMyBirthdate } from "@/lib/profile-age.functions";
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
  /** Saves a birthdate. Returns "ok" | "underage" | throws for other errors. */
  submitBirthdate: (birthdate: string) => Promise<"ok" | "underage">;
  completeWelcome: () => Promise<void>;
};

const LifecycleCtx = createContext<Ctx>({
  state: "signed_out",
  facts: null,
  userId: null,
  isReady: false,
  refresh: async () => {},
  submitBirthdate: async () => "ok",
  completeWelcome: async () => {},
});

export const useAccountLifecycle = () => useContext(LifecycleCtx);

export function AccountLifecycleProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();

  const fetchLifecycle = useServerFn(getAccountLifecycle);
  const repairProfile = useServerFn(ensureProfileRow);
  const saveBirthdate = useServerFn(setMyBirthdate);
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

  const submitBirthdate = useCallback(
    async (birthdate: string): Promise<"ok" | "underage"> => {
      try {
        await saveBirthdate({ data: { birthdate } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // The DB trigger owns the 18+ decision.
        if (/18\+|under\s?18|too young/i.test(msg)) {
          setUnderage(true);
          return "underage";
        }
        throw err;
      }
      await refresh();
      return "ok";
    },
    [saveBirthdate, refresh],
  );

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
      submitBirthdate,
      completeWelcome,
    }),
    [state, query.data, userId, refresh, submitBirthdate, completeWelcome],
  );

  return <LifecycleCtx.Provider value={value}>{children}</LifecycleCtx.Provider>;
}
