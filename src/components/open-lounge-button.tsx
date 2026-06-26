import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { joinCollabLounge } from "@/lib/instant.functions";

type Props = {
  collabPostId: string;
  ownerUserId: string;
  className?: string;
};

/**
 * Drop into the Collab's private Lounge. Visible to:
 *  - the Collab owner
 *  - users with an accepted `collab_invites` row
 *  - users with an accepted `collab_guest_applications` row matched to them
 *
 * Non-members render nothing — the Lounge isn't a public surface for them.
 */
export function OpenLoungeButton({ collabPostId, ownerUserId, className }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const joinFn = useServerFn(joinCollabLounge);

  const isOwner = !!user && user.id === ownerUserId;

  const { data: isMember = false } = useQuery({
    queryKey: ["collab-lounge-access", collabPostId, user?.id],
    enabled: !!user && !isOwner,
    queryFn: async () => {
      const [{ data: inv }, { data: ga }] = await Promise.all([
        supabase
          .from("collab_invites")
          .select("id")
          .eq("collab_post_id", collabPostId)
          .eq("invitee_user_id", user!.id)
          .eq("status", "accepted")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("collab_guest_applications")
          .select("id")
          .eq("collab_post_id", collabPostId)
          .eq("matched_user_id", user!.id)
          .eq("status", "accepted")
          .limit(1)
          .maybeSingle(),
      ]);
      return !!inv?.id || !!ga?.id;
    },
  });

  const open = useMutation({
    mutationFn: () => joinFn({ data: { collabPostId } }),
    onSuccess: ({ roomId }) =>
      router.navigate({ to: "/lounge/$id", params: { id: roomId } }),
    onError: (e: Error) => toast.error(e.message ?? "Couldn't open the Lounge"),
  });

  if (!user) return null;
  if (!isOwner && !isMember) return null;

  return (
    <Button
      size="sm"
      onClick={() => open.mutate()}
      disabled={open.isPending}
      className={`rounded-full gap-1.5 ${className ?? ""}`}
      title="Drop into the Collab's private Lounge"
    >
      <Radio className="h-3.5 w-3.5" />
      {open.isPending ? "Opening…" : "Open the Lounge"}
    </Button>
  );
}
