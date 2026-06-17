import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PictureInPicture2, Mic, MicOff, Video, VideoOff, MonitorPlay, X, Sparkles } from "lucide-react";
import type { useMediaRoom } from "@/hooks/use-media-room";

type Media = ReturnType<typeof useMediaRoom>;
type Source = "me" | "speaker" | "tool";
type DirectorPreset = "tool" | "split" | "cam";

type ProfileLookup = Map<
  string,
  { display_name: string | null; username: string | null; avatar_url: string | null }
>;

const PIP_SIZE_KEY = "pip:size";
const DEFAULT_PIP_SIZE = { width: 420, height: 300 };

export function isDocPipSupported(): boolean {
  return typeof window !== "undefined" && !!window.documentPictureInPicture;
}

export function useWorkshopPip(opts: {
  media: Media;
  meDisplay: string;
  profileLookup: ProfileLookup;
}) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const supported = useMemo(() => isDocPipSupported(), []);

  const open = useCallback(async () => {
    if (!supported) return;
    if (window.documentPictureInPicture?.window) {
      window.documentPictureInPicture.window.focus();
      return;
    }
    // Restore last size if remembered.
    let size = DEFAULT_PIP_SIZE;
    try {
      const raw = localStorage.getItem(PIP_SIZE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { width: number; height: number };
        if (parsed?.width && parsed?.height) size = parsed;
      }
    } catch { /* noop */ }
    try {
      const w = await window.documentPictureInPicture!.requestWindow({
        width: size.width,
        height: size.height,
      });
      // Copy stylesheets so Tailwind classes work inside the PiP document.
      for (const node of Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))) {
        w.document.head.appendChild(node.cloneNode(true));
      }
      // Mount root.
      const mount = w.document.createElement("div");
      mount.id = "pip-root";
      mount.style.cssText = "height:100%;width:100%;";
      w.document.body.style.cssText = "margin:0;height:100vh;background:#0a0a0a;color:#fff;font-family:inherit;";
      w.document.body.appendChild(mount);
      // Remember size on close.
      const persist = () => {
        try {
          localStorage.setItem(PIP_SIZE_KEY, JSON.stringify({ width: w.innerWidth, height: w.innerHeight }));
        } catch { /* noop */ }
      };
      w.addEventListener("resize", persist);
      w.addEventListener("pagehide", () => { persist(); setPipWindow(null); }, { once: true });
      setPipWindow(w);
    } catch (err) {
      console.error("[pip] requestWindow failed", err);
    }
  }, [supported]);

  const close = useCallback(() => {
    pipWindow?.close();
    setPipWindow(null);
  }, [pipWindow]);

  // Close PiP when the component unmounts (workshop tab leaves).
  useEffect(() => {
    return () => {
      try {
        window.documentPictureInPicture?.window?.close();
      } catch {
        /* noop */
      }
    };
  }, []);

  const portal = pipWindow
    ? createPortal(
        <PipBody
          media={opts.media}
          meDisplay={opts.meDisplay}
          profileLookup={opts.profileLookup}
          onClose={close}
        />,
        pipWindow.document.getElementById("pip-root")!,
      )
    : null;

  return { supported, open, close, isOpen: !!pipWindow, portal };
}

function PipBody({
  media,
  meDisplay,
  profileLookup,
  onClose,
}: {
  media: Media;
  meDisplay: string;
  profileLookup: ProfileLookup;
  onClose: () => void;
}) {
  // When a screen share is active, render Director mode. We branch at the very
  // top via a child component swap so each branch keeps a stable hook order.
  if (media.screenSharerId) {
    return <DirectorBody media={media} profileLookup={profileLookup} onClose={onClose} />;
  }
  return <StandardPipBody media={media} meDisplay={meDisplay} profileLookup={profileLookup} onClose={onClose} />;
}

function StandardPipBody({
  media,
  meDisplay,
  profileLookup,
  onClose,
}: {
  media: Media;
  meDisplay: string;
  profileLookup: ProfileLookup;
  onClose: () => void;
}) {
  const [source, setSource] = useState<Source>("me");
  const [followSpeaker, setFollowSpeaker] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Sticky active speaker (1.5s hold when follow is on, 750ms otherwise).
  const [stickySpeakerId, setStickySpeakerId] = useState<string | null>(null);
  const lastSpokeRef = useRef<number>(0);
  useEffect(() => {
    const hold = followSpeaker ? 1500 : 750;
    const id = window.setInterval(() => {
      const speaking = media.peers.find((p) => p.speaking);
      if (speaking) {
        lastSpokeRef.current = Date.now();
        setStickySpeakerId(speaking.userId);
      } else if (Date.now() - lastSpokeRef.current > hold) {
        // keep last until hold expires; no-op afterwards
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [media.peers, followSpeaker]);

  const speaker = useMemo(() => {
    if (!stickySpeakerId) return null;
    return media.peers.find((p) => p.userId === stickySpeakerId) ?? null;
  }, [media.peers, stickySpeakerId]);

  const speakerProfile = speaker ? profileLookup.get(speaker.userId) : null;
  const speakerName = speaker
    ? speakerProfile?.display_name || speakerProfile?.username || "Speaker"
    : "Waiting for speaker…";

  // Tool source = active shared screen (local or remote)
  const remoteSharer = useMemo(
    () => (media.screenSharerId ? media.peers.find((p) => p.userId === media.screenSharerId && p.stream) : null),
    [media.screenSharerId, media.peers],
  );
  const toolStream: MediaStream | null = media.isScreenSharing
    ? (media.screenStream ?? null)
    : (remoteSharer?.stream ?? null);
  const toolLabel = media.isScreenSharing
    ? "Your screen"
    : (remoteSharer ? `${profileLookup.get(remoteSharer.userId)?.display_name || profileLookup.get(remoteSharer.userId)?.username || "Someone"}'s screen` : "No shared screen");

  // Auto-switch to Tool source the moment someone starts sharing — common bootcamp flow.
  const lastSharerRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (lastSharerRef.current === undefined) {
      lastSharerRef.current = media.screenSharerId;
      return;
    }
    if (media.screenSharerId && lastSharerRef.current !== media.screenSharerId) {
      setSource("tool");
    }
    lastSharerRef.current = media.screenSharerId;
  }, [media.screenSharerId]);

  // Wire video element.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (source === "me") {
      el.srcObject = media.localStream ?? null;
    } else if (source === "speaker") {
      el.srcObject = speaker?.stream ?? null;
    } else {
      el.srcObject = toolStream;
    }
    if (el.srcObject) el.play().catch(() => {});
  }, [source, media.localStream, speaker, toolStream]);

  // Wire mixed peer audio (always on while PiP open).
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const stream = new MediaStream();
    for (const p of media.peers) {
      if (!p.stream) continue;
      for (const t of p.stream.getAudioTracks()) stream.addTrack(t);
    }
    el.srcObject = stream;
    el.play().catch(() => {});
  }, [media.peers]);

  const showVideo =
    source === "me" ? !!media.localStream && media.cameraOn :
    source === "speaker" ? !!speaker?.stream && speaker?.mode === "video" :
    !!toolStream;

  const label =
    source === "me" ? meDisplay :
    source === "speaker" ? speakerName :
    toolLabel;

  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", background: "#0a0a0a" }}>
      <div style={{ position: "relative", flex: 1, background: "#000" }}>
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={source === "me"}
            style={{ width: "100%", height: "100%", objectFit: source === "tool" ? "contain" : "cover" }}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#888", fontSize: 13, padding: 16, textAlign: "center" }}>
            {source === "me" ? "Camera off" :
             source === "speaker" ? (speaker ? "Speaker audio only" : "Waiting for speaker…") :
             "No shared screen yet"}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            left: 10,
            bottom: 10,
            right: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#fff",
            fontSize: 12,
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
          }}
        >
          {source === "speaker" && speaker?.speaking ? (
            <Mic size={14} />
          ) : (
            <MicOff size={14} style={{ opacity: 0.5 }} />
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {label}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, padding: 6, background: "#111", borderTop: "1px solid #222", alignItems: "center" }}>
        <SourceChip active={source === "me"} onClick={() => setSource("me")}>Me</SourceChip>
        <SourceChip active={source === "speaker"} onClick={() => setSource("speaker")}>Speaker</SourceChip>
        <SourceChip active={source === "tool"} onClick={() => setSource("tool")}>
          <MonitorPlay size={11} style={{ marginRight: 4 }} /> Tool
        </SourceChip>
        {source === "speaker" && (
          <button
            onClick={() => setFollowSpeaker((v) => !v)}
            title={followSpeaker ? "Following active speaker" : "Follow active speaker"}
            style={{
              padding: "4px 8px",
              borderRadius: 999,
              background: followSpeaker ? "rgba(34,197,94,0.18)" : "transparent",
              color: followSpeaker ? "#86efac" : "#888",
              border: "1px solid " + (followSpeaker ? "#22c55e" : "#333"),
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            {followSpeaker ? "Following" : "Follow"}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <IconBtn onClick={media.toggleMute} title={media.muted ? "Unmute" : "Mute"}>
          {media.muted ? <MicOff size={13} /> : <Mic size={13} />}
        </IconBtn>
        <IconBtn onClick={() => media.setCameraEnabled(!media.cameraOn)} title={media.cameraOn ? "Camera off" : "Camera on"}>
          {media.cameraOn ? <Video size={13} /> : <VideoOff size={13} />}
        </IconBtn>
        <button
          onClick={onClose}
          title="Return to workshop"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            borderRadius: 999,
            background: "#222",
            color: "#fff",
            border: "1px solid #333",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <X size={12} /> Return
        </button>
      </div>
      <audio ref={audioRef} autoPlay />
    </div>
  );
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 999,
        background: "#222",
        color: "#fff",
        border: "1px solid #333",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SourceChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        background: active ? "#fff" : "transparent",
        color: active ? "#000" : "#bbb",
        border: "1px solid " + (active ? "#fff" : "#333"),
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function PopOutButton({
  onClick,
  supported,
  isOpen,
}: {
  onClick: () => void;
  supported: boolean;
  isOpen: boolean;
}) {
  const title = !supported
    ? "Pop-out isn't supported in this browser"
    : isOpen
      ? "Pop-out is open"
      : "Pop out";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!supported}
      className="absolute right-12 top-3 z-20 rounded-full bg-background/90 p-1.5 text-ink shadow-sm ring-1 ring-border hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed"
      aria-label={title}
      title={title}
    >
      <PictureInPicture2 className="h-3.5 w-3.5" />
    </button>
  );
}
