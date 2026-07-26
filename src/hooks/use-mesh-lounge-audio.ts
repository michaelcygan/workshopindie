/**
 * Mesh-provider implementation of `LoungeAudioApi`.
 *
 * Thin adapter over `useMediaRoom` so the rest of the Lounge UI can consume
 * one shape regardless of transport. Behavior is unchanged from the pre-Stream
 * Lounge — this exists so the `mesh` provider can go through the same
 * `<LoungeAudioProvider>` boundary as `stream`, and so we have a clean
 * rollback target while the Stream rollout hardens.
 */
import { useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMediaRoom, type MediaPeer } from "@/hooks/use-media-room";
import {
  type LoungeAudioApi,
  type LoungeParticipant,
  type LoungeRole,
  sortLoungeParticipants,
} from "@/lib/lounge-audio-types";

export function useMeshLoungeAudio(
  roomId: string,
  opts: { participation: "chat" | "audio" },
): LoungeAudioApi {
  const { user } = useAuth();
  const media = useMediaRoom(roomId, { camera: false });

  const role: LoungeRole = media.busy
    ? "connecting"
    : media.audioJoined
      ? "speaker" // mesh has no queue — anyone joined-audio is a speaker.
      : "listener";

  const participants = useMemo<LoungeParticipant[]>(() => {
    const list: LoungeParticipant[] = media.peers.map((p: MediaPeer) => ({
      userId: p.userId,
      displayName: null,
      avatarUrl: null,
      isSpeaking: !!p.speaking,
      isDominant: false,
      isSelf: false,
      role: "speaker",
      muted: false,
      connectionQuality: 2,
    }));
    if (user && media.audioJoined) {
      list.unshift({
        userId: user.id,
        displayName: null,
        avatarUrl: null,
        isSpeaking: !!media.speaking,
        isDominant: false,
        isSelf: true,
        role: "speaker",
        muted: !!media.muted,
        connectionQuality: 2,
      });
    }
    return sortLoungeParticipants(list);
  }, [media.peers, media.audioJoined, media.speaking, media.muted, user]);

  const requestMic = useCallback(async () => {
    if (opts.participation !== "audio") return;
    await media.joinAudio();
  }, [media, opts.participation]);

  const leaveMic = useCallback(async () => {
    await media.leaveAudio();
  }, [media]);

  const disconnect = useCallback(async () => {
    await media.leave();
  }, [media]);

  const toggleMute = useCallback(async () => {
    media.toggleMute();
  }, [media]);

  const noop = useCallback(async () => {
    /* mesh has no queue / offer step */
  }, []);

  return {
    connected: media.audioJoined,
    role,
    muted: !!media.muted,
    busy: !!media.busy,
    error: media.error
      ? { code: "unknown", message: String(media.error) }
      : null,
    speakerCount: participants.filter((p) => p.role === "speaker").length,
    queuePosition: 0,
    participants,
    autoplayBlocked: false,
    resumeAudio: async () => {
      /* mesh handles autoplay inside <audio> elements it owns */
    },
    requestMic,
    acceptMicOffer: noop,
    leaveQueue: noop,
    toggleMute,
    leaveMic,
    disconnect,
  };
}
