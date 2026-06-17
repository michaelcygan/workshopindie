import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PictureInPicture2, Mic, MicOff, X } from "lucide-react";
import type { useMediaRoom } from "@/hooks/use-media-room";

type Media = ReturnType<typeof useMediaRoom>;
type Source = "me" | "speaker";

type ProfileLookup = Map<
  string,
  { display_name: string | null; username: string | null; avatar_url: string | null }
>;

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
    try {
      const w = await window.documentPictureInPicture!.requestWindow({
        width: 380,
        height: 280,
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
      w.addEventListener("pagehide", () => setPipWindow(null), { once: true });
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
  const [source, setSource] = useState<Source>("me");
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Sticky active speaker (750 ms hold).
  const [stickySpeakerId, setStickySpeakerId] = useState<string | null>(null);
  const lastSpokeRef = useRef<number>(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      const speaking = media.peers.find((p) => p.speaking);
      if (speaking) {
        lastSpokeRef.current = Date.now();
        setStickySpeakerId(speaking.userId);
      } else if (Date.now() - lastSpokeRef.current > 750) {
        // keep last speaker visible until silence > 750ms — then clear only if none
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [media.peers]);

  const speaker = useMemo(() => {
    if (!stickySpeakerId) return null;
    return media.peers.find((p) => p.userId === stickySpeakerId) ?? null;
  }, [media.peers, stickySpeakerId]);

  const speakerName = speaker
    ? profileLookup[speaker.userId]?.display_name ||
      profileLookup[speaker.userId]?.username ||
      "Speaker"
    : "Waiting for speaker…";

  // Wire video element.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (source === "me") {
      el.srcObject = media.localStream ?? null;
    } else if (source === "speaker") {
      el.srcObject = speaker?.stream ?? null;
    }
    if (el.srcObject) el.play().catch(() => {});
  }, [source, media.localStream, speaker]);

  // Wire mixed peer audio (always on while PiP open).
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    // Combine all peer audio tracks into one stream.
    const stream = new MediaStream();
    for (const p of media.peers) {
      if (!p.stream) continue;
      for (const t of p.stream.getAudioTracks()) stream.addTrack(t);
    }
    el.srcObject = stream;
    el.play().catch(() => {});
  }, [media.peers]);

  const showVideo = source === "me" ? !!media.localStream && media.cameraOn : !!speaker?.stream && speaker?.mode === "video";

  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", background: "#0a0a0a" }}>
      <div style={{ position: "relative", flex: 1, background: "#000" }}>
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={source === "me"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#888", fontSize: 13 }}>
            {source === "me" ? "Camera off" : speaker ? "Speaker audio only" : "Waiting for speaker…"}
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
            {source === "me" ? meDisplay : speakerName}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, padding: 6, background: "#111", borderTop: "1px solid #222" }}>
        <SourceChip active={source === "me"} onClick={() => setSource("me")}>
          Me
        </SourceChip>
        <SourceChip active={source === "speaker"} onClick={() => setSource("speaker")}>
          Speaker
        </SourceChip>
        <div style={{ flex: 1 }} />
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
