import { Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { NudgeCard } from "./nudge-card";

type Props = {
  workId: string;
  createdBy: string;
  publishedAt: string | null;
  creditCount: number;
  /** Scrolls to the existing credit layer / opens the credit flow. */
  onAddCredits?: () => void;
};

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

/**
 * Owner-only, time-boxed nudge that appears on a freshly published Work
 * (within 24h) when no collaborators have been credited yet. After 24h or
 * once credits exist, it never renders.
 *
 * The actual "add credits" flow already exists in WorkCreditLayer; this
 * nudge just routes attention there.
 */
export function WorkPublishedNudge({ workId, createdBy, publishedAt, creditCount, onAddCredits }: Props) {
  const { user } = useAuth();
  if (!user || user.id !== createdBy) return null;
  if (!publishedAt) return null;
  if (creditCount > 0) return null;
  const age = Date.now() - new Date(publishedAt).getTime();
  if (age < 0 || age > TWENTY_FOUR_HOURS) return null;

  return (
    <div className="mt-6">
      <NudgeCard
        storageKey={`nudge:work-credits:${workId}:${user.id}`}
        icon={<Users className="h-4 w-4" />}
        title="Got collaborators? Credit them."
        description="Tag the people who helped make this. They'll show up in the byline and on their own profiles."
      >
        {onAddCredits ? (
          <button
            type="button"
            onClick={onAddCredits}
            className="inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Add credits
          </button>
        ) : (
          <a
            href="#credits"
            className="inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Add credits
          </a>
        )}
      </NudgeCard>
    </div>
  );
}
