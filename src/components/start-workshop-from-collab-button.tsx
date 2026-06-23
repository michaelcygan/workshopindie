import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openWorkshopOnCollab } from "@/lib/collab-workshop.functions";

type Props = {
  collabPostId: string;
  collabSlug: string;
  /** Pass through so we can show a "rejoin" affordance when the workshop is already live. */
  liveWorkshopSlug: string | null;
  isLive: boolean;
  /** Show button to author only in v1; accepted-collab gating is a v1.5 follow-up. */
  isAuthor: boolean;
  className?: string;
};

/**
 * Canonical "Start a Workshop" button for a Collab page. Visible to the
 * collab author. When a workshop already exists and is live, swaps to
 * "Enter Workshop". v1 keeps gating to author — accepted-collaborator can
 * use the existing "Live now — join" affordance.
 */
export function StartWorkshopFromCollabButton({
  collabPostId,
  collabSlug,
  liveWorkshopSlug,
  isLive,
  isAuthor,
  className,
}: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const openFn = useServerFn(openWorkshopOnCollab);

  const mut = useMutation({
    mutationFn: () => openFn({ data: { collabPostId } }),
    onSuccess: ({ slug }) => {
      toast.success("Workshop is live — heading in");
      qc.invalidateQueries({ queryKey: ["collab", collabSlug] });
      router.navigate({ to: "/workshops/$slug", params: { slug } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Non-authors only see this when there's a live workshop they can enter.
  if (!isAuthor && !(isLive && liveWorkshopSlug)) return null;

  if (isLive && liveWorkshopSlug) {
    return (
      <Button
        size="sm"
        className={`rounded-full gap-1.5 ${className ?? ""}`}
        onClick={() => router.navigate({ to: "/workshops/$slug", params: { slug: liveWorkshopSlug } })}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        Enter Workshop
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className={`rounded-full gap-1.5 ${className ?? ""}`}
      disabled={mut.isPending}
      onClick={() => mut.mutate()}
    >
      <Radio className="h-3.5 w-3.5" />
      {mut.isPending ? "Opening…" : "Start a Workshop"}
    </Button>
  );
}
