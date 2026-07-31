/**
 * Compatibility shim.
 *
 * `useMediaRoom` used to run the legacy WebRTC mesh transport. The Lounge is
 * now Stream-SFU + chat only (audio-first, no camera, no screen share). This
 * module keeps the old return shape so `ChannelView` and `MediaPanel` can
 * consume it unchanged, but every call now delegates to `useLoungeAudio()`.
 *
 * Camera/local-stream fields have been removed entirely — new code should use
 * `useLoungeAudio()` directly.
 */
import { useCallback, useMemo } from "react";
import { useLoungeAudio } from "@/hooks/use-lounge-audio";

export const ROOM_CAP = 20;

export type MediaMode = "voice";

export type MediaPeer = {
  userId: string;
  speaking: boolean;
  mode: MediaMode;
  stream: MediaStream | null;
};

export type UseMediaRoomReturn = {
  joined: boolean;
  audioJoined: boolean;
  mode: MediaMode;
  muted: boolean;
  speaking: boolean;
  count: number;
  peers: MediaPeer[];
  error: string | null;
  busy: boolean;
  screenStream: MediaStream | null;
  screenSharerId: string | null;
  isScreenSharing: boolean;
  joinAudio: () => Promise<void>;
  leaveAudio: () => Promise<void>;
  toggleMute: () => Promise<void>;
  leave: () => void;
};

export function useMediaRoom(
  _roomId: string | undefined,
): UseMediaRoomReturn {
  const api = useLoungeAudio();

  const self = useMemo(
    () => api.participants.find((p) => p.isSelf) ?? null,
    [api.participants],
  );

  const peers: MediaPeer[] = useMemo(
    () =>
      api.participants
        .filter((p) => !p.isSelf)
        .map((p) => ({
          userId: p.userId,
          speaking: p.isSpeaking,
          mode: "voice" as const,
          stream: null,
        })),
    [api.participants],
  );

  const leave = useCallback(() => {
    void api.disconnect();
  }, [api]);

  return {
    joined: api.connected,
    audioJoined: api.connected && api.role === "speaker",
    mode: "voice",
    muted: api.muted,
    
    speaking: self?.isSpeaking ?? false,
    count: api.participants.length,
    peers,
    error: api.error?.message ?? null,
    busy: api.busy,
    screenStream: null,
    screenSharerId: null,
    isScreenSharing: false,
    joinAudio: api.requestMic,
    leaveAudio: api.leaveMic,
    toggleMute: api.toggleMute,
    leave,
  };
}
