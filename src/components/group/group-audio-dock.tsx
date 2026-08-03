/**
 * Persistent Group audio dock.
 *
 * Bottom pill on mobile (safe-area aware, 44px targets) that expands into a
 * sheet with participants and controls; a compact floating dock on desktop.
 * Never renders camera, screen-share, or video affordances.
 */
import { useState } from "react";
import { Mic, MicOff, Hand, LogOut, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLoungeAudio } from "@/hooks/use-lounge-audio";
import { cn } from "@/lib/utils";

function roleLabel(
  role: string,
  reconnecting: boolean,
  muted: boolean,
  queuePosition: number,
): string {
  if (reconnecting) return "Reconnecting";
  if (role === "connecting") return "Connecting";
  if (role === "speaker") return muted ? "Mic off" : "Speaking";
  if (role === "waiting" || role === "offered") {
    return queuePosition > 0 ? `Waiting · #${queuePosition}` : "Waiting";
  }
  return "Listening";
}

export function GroupAudioDock({
  groupName,
  connectedCount,
  onLeave,
}: {
  groupName: string;
  connectedCount: number;
  onLeave: () => void | Promise<void>;
}) {
  const audio = useLoungeAudio();
  const [open, setOpen] = useState(false);

  const label = roleLabel(audio.role, audio.reconnecting, audio.muted, audio.queuePosition);
  const isSpeaker = audio.role === "speaker";
  const busy = audio.busy || audio.role === "connecting";

  const leave = async () => {
    setOpen(false);
    try {
      await audio.disconnect();
    } catch {
      /* transport already gone */
    }
    await onLeave();
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-6"
      role="region"
      aria-label="Group audio controls"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-full border border-border bg-surface/95 px-2 py-2 shadow-soft backdrop-blur md:max-w-lg">
        <span
          className={cn(
            "ml-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full",
            audio.connected ? "bg-primary/10 text-primary" : "bg-muted text-ink-muted",
          )}
          aria-hidden
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </span>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center rounded-full px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Group audio: ${label}. Open participants and controls`}
            >
              <span className="truncate text-sm font-medium text-ink">
                {groupName} audio
              </span>
              <span className="truncate text-[11px] text-ink-muted">
                {label}
                {connectedCount > 0 ? ` · ${connectedCount} connected` : ""}
                {audio.speakerCount > 0 ? ` · ${audio.speakerCount} speaking` : ""}
              </span>
            </button>
          </SheetTrigger>

          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <SheetHeader>
              <SheetTitle className="font-display">{groupName} audio</SheetTitle>
            </SheetHeader>

            {audio.error ? (
              <p className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-ink-soft">
                {audio.error.message}
              </p>
            ) : null}

            <ul className="mt-4 space-y-2">
              {audio.participants.length === 0 ? (
                <li className="text-sm text-ink-muted">
                  You're the first one here. Others will appear as they join.
                </li>
              ) : (
                audio.participants.map((p) => (
                  <li
                    key={p.userId}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2"
                  >
                    <Avatar className="h-8 w-8">
                      {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
                      <AvatarFallback className="text-[11px]">
                        {(p.displayName ?? "M").slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {p.displayName ?? "Member"}
                      {p.isSelf ? " (you)" : ""}
                    </span>
                    <span className="shrink-0 text-[11px] text-ink-muted">
                      {p.role === "speaker"
                        ? p.isSpeaking
                          ? "Speaking"
                          : "On mic"
                        : p.role === "waiting"
                          ? "Waiting"
                          : "Listening"}
                    </span>
                  </li>
                ))
              )}
            </ul>

            <div className="mt-5 flex flex-wrap gap-2">
              {isSpeaker ? (
                <>
                  <Button
                    variant="outline"
                    className="min-h-11 gap-2 rounded-full"
                    onClick={() => void audio.toggleMute()}
                  >
                    {audio.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {audio.muted ? "Unmute" : "Mute"}
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11 gap-2 rounded-full"
                    onClick={() => void audio.leaveMic()}
                  >
                    Give up mic
                  </Button>
                </>
              ) : audio.role === "waiting" || audio.role === "offered" ? (
                <Button
                  variant="outline"
                  className="min-h-11 gap-2 rounded-full"
                  onClick={() => void audio.leaveQueue()}
                >
                  Leave the mic queue
                </Button>
              ) : (
                <Button
                  className="min-h-11 gap-2 rounded-full"
                  disabled={audio.busy}
                  onClick={() => void audio.requestMic()}
                >
                  <Hand className="h-4 w-4" /> Request mic
                </Button>
              )}

              <Button
                variant="ghost"
                className="min-h-11 gap-2 rounded-full text-ink-muted"
                onClick={() => void leave()}
              >
                <LogOut className="h-4 w-4" /> Leave audio
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {isSpeaker ? (
          <Button
            size="icon"
            variant={audio.muted ? "outline" : "default"}
            className="h-11 w-11 shrink-0 rounded-full"
            onClick={() => void audio.toggleMute()}
            aria-label={audio.muted ? "Unmute microphone" : "Mute microphone"}
          >
            {audio.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        ) : (
          <Button
            size="icon"
            variant="outline"
            className="h-11 w-11 shrink-0 rounded-full"
            disabled={audio.busy}
            onClick={() => void audio.requestMic()}
            aria-label="Request the microphone"
          >
            <Hand className="h-4 w-4" />
          </Button>
        )}

        <Button
          size="icon"
          variant="ghost"
          className="h-11 w-11 shrink-0 rounded-full text-ink-muted"
          onClick={() => void leave()}
          aria-label="Leave audio"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
