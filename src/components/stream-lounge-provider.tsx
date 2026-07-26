/**
 * Live-audio provider boundary for a single Lounge room.
 *
 * Chooses between the legacy WebRTC mesh and the Stream SFU at mount time
 * based on `LOUNGE_AUDIO_PROVIDER`. Every consumer downstream reads the same
 * `LoungeAudioApi` via `useLoungeAudio()`, so switching transports never
 * changes hook order or component shapes.
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
import { useMeshLoungeAudio } from "@/hooks/use-mesh-lounge-audio";
import { useStreamLoungeAudio } from "@/hooks/use-stream-lounge-audio";
import {
  LOUNGE_AUDIO_PROVIDER,
  isLoungeAudioSupported,
} from "@/lib/lounge-constants";
import { getLoungeStreamToken } from "@/lib/stream-video.functions";
import type { LoungeParticipation } from "@/lib/lounge-constants";

type Props = {
  roomId: string;
  participation: LoungeParticipation;
  children: ReactNode;
};

export function LoungeAudioProvider(props: Props) {
  const supported = isLoungeAudioSupported();
  if (!supported || LOUNGE_AUDIO_PROVIDER === "mesh") {
    return <MeshProvider {...props} />;
  }
  return <StreamProvider {...props} />;
}

function MeshProvider({ roomId, participation, children }: Props) {
  const api = useMeshLoungeAudio(roomId, { participation });
  return (
    <LoungeAudioContext.Provider value={api}>
      {children}
    </LoungeAudioContext.Provider>
  );
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
        // getOrCreate is idempotent server-side; try create:true as a fallback.
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
    // Fall back to mesh adapter so `useLoungeAudio()` still returns a valid
    // API — the surrounding UI can show a friendly error without unmounting.
    return <MeshProvider roomId={roomId} participation={participation}>{children}</MeshProvider>;
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

/** Inner component so `useStreamLoungeAudio` runs inside `<StreamCall>`. */
function StreamInner({ roomId, participation, children }: Props) {
  const api = useStreamLoungeAudio(roomId, { participation });
  return (
    <LoungeAudioContext.Provider value={api}>
      {children}
    </LoungeAudioContext.Provider>
  );
}
