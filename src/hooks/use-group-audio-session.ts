/**
 * Group audio session lifecycle.
 *
 * Merely viewing a Group never touches Stream. `join()` performs the ordered
 * server admission (auth → membership → room match → atomic seat claim) and
 * only then hands a room id to the provider, which mints the Stream token.
 * Joining never requests microphone permission — the user enters as a listener
 * with the mic off and asks for it separately.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  getGroupAudioState,
  joinGroupAudio,
  leaveGroupAudio,
} from "@/lib/group-audio.functions";

export type GroupAudioSessionStatus = "idle" | "joining" | "joined" | "error";

export function useGroupAudioSession(groupId: string, opts: { isMember: boolean }) {
  const { user } = useAuth();
  const join = useServerFn(joinGroupAudio);
  const leave = useServerFn(leaveGroupAudio);
  const readState = useServerFn(getGroupAudioState);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [status, setStatus] = useState<GroupAudioSessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<string | null>(null);
  roomRef.current = roomId;

  // Ambient "is anyone live" signal — counts only, safe for every viewer.
  const { data: live, refetch: refetchLive } = useQuery({
    queryKey: ["group-audio-state", groupId],
    queryFn: () => readState({ data: { groupId } }),
    refetchInterval: 45_000,
    staleTime: 20_000,
  });

  const joinAudio = useCallback(async () => {
    if (!user || !opts.isMember || status === "joining" || roomRef.current) return;
    setStatus("joining");
    setError(null);
    try {
      const res = await join({ data: { groupId } });
      setRoomId(res.roomId);
      setStatus("joined");
      refetchLive();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Couldn't join audio");
    }
  }, [user, opts.isMember, status, join, groupId, refetchLive]);

  const leaveAudio = useCallback(async () => {
    const rid = roomRef.current;
    setRoomId(null);
    setStatus("idle");
    setError(null);
    if (!rid) return;
    try {
      await leave({ data: { roomId: rid } });
    } catch {
      /* seat is swept server-side if this fails */
    }
    refetchLive();
  }, [leave, refetchLive]);

  // Heartbeat so the seat stays warm, plus best-effort release on unload.
  useEffect(() => {
    if (!roomId || !user) return;
    const beat = () => {
      supabase
        .from("instant_presence")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .then(() => undefined);
    };
    const iv = window.setInterval(beat, 30_000);
    const release = () => {
      supabase
        .from("instant_presence")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .then(() => undefined);
    };
    window.addEventListener("beforeunload", release);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("beforeunload", release);
      release();
    };
  }, [roomId, user]);

  return {
    roomId,
    status,
    error,
    connectedCount: live?.connectedCount ?? 0,
    speakingCount: live?.speakingCount ?? 0,
    isLive: !!live?.live,
    joinAudio,
    leaveAudio,
  };
}

export type GroupAudioSession = ReturnType<typeof useGroupAudioSession>;
