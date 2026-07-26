/**
 * Live-audio provider boundary for a single Lounge room.
 *
 * Stream SFU is the only supported transport. Every consumer downstream reads
 * the API via `useLoungeAudio()`.
 *
 * SSR safety: nothing in this file — including the Stream SDK bundle — should
 * ever evaluate on the server. The route wraps this component in
 * `<ClientOnly>` and dynamic-imports the SDK behind a hydration gate.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  type Call,
} from "@stream-io/video-react-sdk";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { LoungeAudioContext } from "@/hooks/use-lounge-audio";
import { useStreamLoungeAudio } from "@/hooks/use-stream-lounge-audio";
import { isLoungeAudioSupported } from "@/lib/lounge-constants";
import { getLoungeStreamToken } from "@/lib/stream-video.functions";
import type { LoungeParticipation } from "@/lib/lounge-constants";
import type { LoungeAudioApi } from "@/lib/lounge-audio-types";

type Props = {
  roomId: string;
  participation: LoungeParticipation;
  children: ReactNode;
};

export function LoungeAudioProvider(props: Props) {
  if (!isLoungeAudioSupported()) {
    return (
      <LoungeAudioContext.Provider value={makeUnavailableApi("Your browser doesn't support live audio.")}>
        {props.children}
      </LoungeAudioContext.Provider>
    );
  }
  return <StreamProvider {...props} />;
}

type TokenPayload = Awaited<ReturnType<typeof getLoungeStreamToken>>;

function StreamProvider({ roomId, participation, children }: Props) {
  const { user } = useAuth();
  const issueToken = useServerFn(getLoungeStreamToken);
  const [payload, setPayload] = useState<TokenPayload | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      try {
        const p = await issueToken({ data: { roomId } });
        if (!cancelled) setPayload(p);
      } catch (e) {
        if (!cancelled) {
          setTokenError(e instanceof Error ? e.message : "Couldn't join audio");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [issueToken, roomId, user]);

  const client = useMemo(() => {
    if (!payload || !user) return null;
    return new StreamVideoClient({
      apiKey: payload.apiKey,
      user: {
        id: payload.user.id,
        name: payload.user.name,
        image: payload.user.image ?? undefined,
      },
      token: payload.token,
    });
  }, [payload, user]);

  const [call, setCall] = useState<Call | null>(null);
  useEffect(() => {
    if (!client || !payload) return;
    const c = client.call(payload.callType, payload.callId);
    let cancelled = false;
    (async () => {
      try {
        await c.join({ create: false });
        if (!cancelled) setCall(c);
      } catch {
        try {
          await c.join({ create: true });
          if (!cancelled) setCall(c);
        } catch (e) {
          if (!cancelled) setTokenError(e instanceof Error ? e.message : "Couldn't join call");
        }
      }
    })();
    return () => {
      cancelled = true;
      c.leave().catch(() => { /* noop */ });
      setCall(null);
    };
  }, [client, payload]);

  useEffect(() => {
    return () => {
      client?.disconnectUser().catch(() => { /* noop */ });
    };
  }, [client]);

  if (tokenError || !client || !call) {
    // Show an inline error via a stub API so surrounding chat/panels keep
    // working without unmounting the Lounge.
    return (
      <LoungeAudioContext.Provider
        value={makeUnavailableApi(tokenError ?? "Connecting…", { busy: !tokenError })}
      >
        {children}
      </LoungeAudioContext.Provider>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <StreamInner roomId={roomId} participation={participation}>
          {children}
        </StreamInner>
      </StreamCall>
    </StreamVideo>
  );
}

function StreamInner({ roomId, participation, children }: Props) {
  const api = useStreamLoungeAudio(roomId, { participation });
  return (
    <LoungeAudioContext.Provider value={api}>
      {children}
    </LoungeAudioContext.Provider>
  );
}

function makeUnavailableApi(message: string, opts: { busy?: boolean } = {}): LoungeAudioApi {
  const noop = async () => { /* audio unavailable */ };
  return {
    connected: false,
    role: "listener",
    muted: false,
    busy: !!opts.busy,
    error: opts.busy ? null : { code: "unknown", message },
    speakerCount: 0,
    queuePosition: 0,
    participants: [],
    autoplayBlocked: false,
    resumeAudio: noop,
    requestMic: noop,
    acceptMicOffer: noop,
    leaveQueue: noop,
    toggleMute: noop,
    leaveMic: noop,
    disconnect: noop,
    moderateSpeaker: noop,
    reconnecting: false,
  };
}
