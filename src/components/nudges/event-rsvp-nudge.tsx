import { CalendarCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { NudgeCard } from "./nudge-card";

type Props = {
  eventId: string;
  rsvpStatus: string | null | undefined;
  /** "pre" | "live" | "post" — only render in "pre" (after RSVP, before doors). */
  phase: "pre" | "live" | "post";
};

/**
 * Persistent inline card shown after a "going" RSVP, in the pre-event window.
 * Replaces the ephemeral success toast with something the user can act on
 * later — the photos uploader and companion thread go live when the doors open.
 */
export function EventRsvpNudge({ eventId, rsvpStatus, phase }: Props) {
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
        description="When the doors open, the companion thread goes live and you'll be able to drop photos right from this page."
      />
    </div>
  );
}

