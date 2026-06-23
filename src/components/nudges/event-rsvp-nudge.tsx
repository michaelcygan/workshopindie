import { CalendarCheck, Camera, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { NudgeCard } from "./nudge-card";

type Props = {
  eventId: string;
  rsvpStatus: string | null | undefined;
  /** "pre" | "live" | "post" — only render in "pre" (after RSVP, before doors). */
  phase: "pre" | "live" | "post";
  /** Anchor IDs on the page so the buttons land in the right section. */
  photosHref?: string;
  companionHref?: string;
};

/**
 * Persistent inline card shown after a "going" RSVP, in the pre-event window.
 * Replaces the ephemeral success toast with something the user can act on
 * later — drop photos / open the companion thread once the event starts.
 */
export function EventRsvpNudge({ eventId, rsvpStatus, phase, photosHref = "#photos", companionHref = "#wall" }: Props) {
  const { user } = useAuth();
  if (!user) return null;
  if (rsvpStatus !== "going") return null;
  if (phase !== "pre") return null;

  return (
    <div className="mt-4">
      <NudgeCard
        storageKey={`nudge:rsvp-going:${eventId}:${user.id}`}
        icon={<CalendarCheck className="h-4 w-4" />}
        title="You're going."
        description="When the doors open, drop photos here and the companion thread goes live for everyone in the room."
      >
        <a
          href={photosHref}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <Camera className="h-3.5 w-3.5" /> Photos
        </a>
        <a
          href={companionHref}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 text-xs font-medium text-ink hover:bg-muted"
        >
          <MessageSquare className="h-3.5 w-3.5" /> Open the thread
        </a>
      </NudgeCard>
    </div>
  );
}
