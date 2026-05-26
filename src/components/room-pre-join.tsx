import { useState } from "react";
import { Mic, Video as VideoIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MediaMode } from "@/hooks/use-media-room";

interface Props {
  title: string;
  initialMode?: MediaMode;
  onConnect: (mode: MediaMode) => void | Promise<void>;
}

/**
 * Pre-join gate for Workshop rooms.
 *
 * Prevents the room from initializing WebRTC / requesting mic+cam permissions /
 * subscribing to signaling until the user clicks Connect. This:
 *   1) defeats bots and silent previews (they don't click)
 *   2) is the consent moment for mic/cam permission
 *   3) ensures TURN credentials (paid relay) are only minted for real users
 */
export function RoomPreJoin({ title, initialMode = "voice", onConnect }: Props) {
  const [mode, setMode] = useState<MediaMode>(initialMode);
  const [connecting, setConnecting] = useState(false);

  async function handle() {
    if (connecting) return;
    setConnecting(true);
    try {
      await onConnect(mode);
    } catch {
      setConnecting(false);
    }
  }

  return (
    <section className="mt-6 flex flex-col items-center rounded-3xl border border-border bg-surface px-6 py-10 text-center md:py-14">
      <span className="gradient-motion mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground">
        <Mic className="h-6 w-6" />
      </span>
      <h2 className="font-display text-2xl text-ink md:text-3xl">You're about to join</h2>
      <p className="mt-1 max-w-md text-sm text-ink-muted">
        <span className="font-medium text-ink">{title}</span> · live with up to 5 artists.
        Your mic{mode === "video" ? " and camera" : ""} will turn on after you connect.
      </p>

      <div className="mt-6 inline-flex items-center gap-1 rounded-full border border-border bg-background p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("voice")}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
            mode === "voice" ? "bg-muted text-ink" : "text-ink-muted hover:text-ink"
          }`}
        >
          <Mic className="h-3.5 w-3.5" /> Voice
        </button>
        <button
          type="button"
          onClick={() => setMode("video")}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
            mode === "video" ? "bg-muted text-ink" : "text-ink-muted hover:text-ink"
          }`}
        >
          <VideoIcon className="h-3.5 w-3.5" /> Video
        </button>
      </div>

      <Button
        size="lg"
        onClick={handle}
        disabled={connecting}
        className="gradient-motion mt-6 rounded-full gap-2 text-primary-foreground"
      >
        {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
        {connecting ? "Connecting…" : "Connect"}
      </Button>

      <p className="mt-4 max-w-sm text-xs text-ink-muted">
        Workshop rooms are peer-to-peer — your video goes directly to other artists in the room,
        not through our servers.
      </p>
    </section>
  );
}
