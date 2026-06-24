import { MonitorPlay, MonitorOff, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Screen Share tool body — the actual capture happens in the room's
 * `useMediaRoom` hook (via WebRTC replaceTrack). This panel is the in-tool
 * surface explaining what's happening and giving a big Start/Stop button.
 *
 * Persistent-scope rooms don't have a live media session, so we render an
 * info card pointing the user toward the live Workshop.
 */
type Media = {
  joined: boolean;
  isScreenSharing: boolean;
  screenSharerId: string | null;
  startScreenShare: () => Promise<void> | void;
  stopScreenShare: () => Promise<void> | void;
  bandwidthReduced?: boolean;
};

export function WorkshopScreenSharePanel({
  media,
  scope,
}: {
  media?: Media;
  scope: "persistent" | "instant";
}) {
  if (scope === "persistent" || !media) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-ink-soft">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MonitorPlay className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg text-ink">Screen Share</h3>
            <p className="mt-1 text-ink-muted">
              Screen sharing runs inside a live Workshop room. Open the live room to share your screen with everyone.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const someoneElse = media.screenSharerId && !media.isScreenSharing;
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MonitorPlay className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-lg text-ink">Screen Share</h3>
          <p className="text-sm text-ink-muted">
            Broadcast your screen, window, or tab to everyone in the room. Your camera pauses while you share.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {media.isScreenSharing ? (
          <Button onClick={() => media.stopScreenShare()} className="rounded-full gap-2">
            <MonitorOff className="h-4 w-4" /> Stop sharing
          </Button>
        ) : (
          <Button
            onClick={() => media.startScreenShare()}
            disabled={!media.joined || !!someoneElse}
            className="rounded-full gap-2"
          >
            <MonitorPlay className="h-4 w-4" /> {someoneElse ? "Someone else is sharing" : "Share my screen"}
          </Button>
        )}
        {!media.joined && (
          <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
            <Info className="h-3 w-3" /> Join the room first
          </span>
        )}
      </div>

      <p className="mt-3 text-[11px] text-ink-muted">
        Tip: in the browser's screen-picker, choose <span className="font-medium text-ink-soft">Entire Screen</span> for demos,
        <span className="font-medium text-ink-soft"> a Window</span> for a single app, or
        <span className="font-medium text-ink-soft"> a Chrome Tab</span> for a webpage (with audio).
      </p>
    </div>
  );
}
