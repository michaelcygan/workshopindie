/**
 * Shared state for the "Now" board (desktop departures board and the mobile
 * stacked rows). Owns lane selection, staggered auto-rotation, cooldown
 * bookkeeping, and prompted creation so both surfaces stay in sync.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useReducedMotion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import type { MemberHomePayload } from "@/lib/home-types";
import type { HomeNowItem, HomeNowLane } from "@/lib/home-now-types";
import { buildNowBoard, markShown, sessionSeed } from "@/lib/home-now-select";
import { createMyBlogDraft } from "@/lib/blog-member.functions";
import { isBlogSeedPromptId } from "@/lib/blog-seed-prompts";

export const NOW_ROTATE_MS = 11_000;
const STAGGER_MS = [0, 2_000, 4_000];
const LANES: HomeNowLane[] = ["live", "make", "explore"];

export function useNowBoard(data: MemberHomePayload, options?: { rotateMs?: number }) {
  const rotateMs = options?.rotateMs ?? NOW_ROTATE_MS;
  const seed = useMemo(() => sessionSeed(), []);
  const board = useMemo(() => buildNowBoard(data, seed), [data, seed]);
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const createDraft = useServerFn(createMyBlogDraft);

  const [indices, setIndices] = useState<Record<HomeNowLane, number>>({
    live: 0,
    make: 0,
    explore: 0,
  });
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const step = useCallback(
    (lane: HomeNowLane, delta: number) => {
      const len = board[lane].length;
      if (len < 2) return;
      setIndices((prev) => ({ ...prev, [lane]: (prev[lane] + delta + len) % len }));
    },
    [board],
  );

  const stepAll = useCallback(
    (delta: number) => {
      LANES.forEach((lane) => step(lane, delta));
    },
    [step],
  );

  const frozen = reduceMotion || paused || hovered || tabHidden;
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (frozen) return;
    const intervals: Array<ReturnType<typeof setInterval>> = [];
    LANES.forEach((lane, i) => {
      if (board[lane].length < 2) return;
      const start = setTimeout(() => {
        step(lane, 1);
        intervals.push(setInterval(() => step(lane, 1), rotateMs));
      }, STAGGER_MS[i]);
      timers.current.push(start);
    });
    return () => {
      timers.current.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, [frozen, board, step, rotateMs]);

  // Cooldown: remember what has been on screen this session.
  useEffect(() => {
    LANES.forEach((lane) => {
      const item = board[lane][indices[lane] % Math.max(1, board[lane].length)];
      if (item) markShown(item.id);
    });
  }, [indices, board]);

  const runAction = useCallback(
    async (item: HomeNowItem) => {
      if (!item.action || pending) return;
      if (item.action.kind === "collab-prompt") {
        const search: Record<string, string> = { prompt: item.action.prompt };
        if (item.action.groupSlug) search.group = item.action.groupSlug;
        navigate({ to: "/collab/new", search } as never);
        return;
      }
      const promptId = item.action.seedPromptId;
      if (!isBlogSeedPromptId(promptId)) return;
      setPending(item.id);
      try {
        const res = await createDraft({ data: { seedPromptId: promptId } });
        if (res.reused) toast("Opened your current draft.");
        navigate({ to: "/me/blog/$id", params: { id: res.id } });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't start a draft.");
      } finally {
        setPending(null);
      }
    },
    [createDraft, navigate, pending],
  );

  const current = useCallback(
    (lane: HomeNowLane): HomeNowItem | undefined => {
      const items = board[lane];
      return items[indices[lane] % Math.max(1, items.length)];
    },
    [board, indices],
  );

  return {
    board,
    indices,
    current,
    step,
    stepAll,
    paused,
    setPaused,
    setHovered,
    pending,
    runAction,
    reduceMotion,
    anyLive: board.live.some((i) => i.isLive),
  };
}
