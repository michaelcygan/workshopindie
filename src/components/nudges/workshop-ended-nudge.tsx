import { Rocket, Share2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { NudgeCard } from "./nudge-card";

type Props = {
  workshopId: string;
  workshopSlug: string;
  workshopTitle: string;
  status: string;
  publishedWorkId: string | null;
  publishedWorkSlug?: string | null;
  /** Viewer is host or confirmed participant. Drives whether to render. */
  isParticipant: boolean;
};

/**
 * "Workshop wrapped — what's next?" nudge.
 *
 * - When the workshop is in a finishing state and no Work has been published
 *   yet, prompt the participant to publish what they made.
 * - When a Work is already published from this workshop, swap to a
 *   share-the-result card with a one-tap copy-link.
 */
export function WorkshopEndedNudge({
  workshopId,
  workshopSlug,
  workshopTitle,
  status,
  publishedWorkId,
  publishedWorkSlug,
  isParticipant,
}: Props) {
  const { user } = useAuth();
  if (!user || !isParticipant) return null;

  const finishing = status === "finalizing" || status === "shipped" || status === "ended" || status === "complete";
  if (!finishing) return null;

  if (publishedWorkId && publishedWorkSlug) {
    const url = `https://workshopindie.com/works/${publishedWorkSlug}`;
    return (
      <div className="mt-6">
        <NudgeCard
          storageKey={`nudge:workshop-share:${workshopId}:${user.id}`}
          icon={<Share2 className="h-4 w-4" />}
          title="Share the result."
          description={`The Work from ${workshopTitle} is published. Send it to the people who'd want to see it.`}
        >
          <Link
            to="/works/$slug"
            params={{ slug: publishedWorkSlug }}
            className="inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Open the Work
          </Link>
          <button
            type="button"
            onClick={() => {
              try {
                void navigator.clipboard?.writeText(url);
                toast.success("Link copied");
              } catch {
                toast.error("Couldn't copy");
              }
            }}
            className="inline-flex h-8 items-center rounded-full border border-border bg-surface px-3.5 text-xs font-medium text-ink hover:bg-muted"
          >
            Copy link
          </button>
        </NudgeCard>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <NudgeCard
        storageKey={`nudge:workshop-publish:${workshopId}:${user.id}`}
        icon={<Rocket className="h-4 w-4" />}
        title="Publish what you made."
        description="Turn this Workshop's output into a Work. The cast and provenance carry over automatically."
      >
        <Link
          to="/works/new"
          search={{ from_workshop: workshopSlug } as never}
          className="inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Publish a Work
        </Link>
      </NudgeCard>
    </div>
  );
}
