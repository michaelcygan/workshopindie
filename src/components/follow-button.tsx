import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, Plus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export function FollowButton({
  targetUserId,
  /** When set, broadcasts a follow notification on `instant:{roomId}` so the
   * followed user sees a live toast inside the workshop. */
  roomId,
}: {
  targetUserId: string;
  roomId?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("follows")
      .select("follower_user_id")
      .eq("follower_user_id", user.id)
      .eq("followed_user_id", targetUserId)
      .maybeSingle()
      .then(({ data }) => setFollowing(!!data));
  }, [user, targetUserId]);

  if (user?.id === targetUserId) return null;

  async function toggle() {
    if (!user) return navigate({ to: "/login" });
    setLoading(true);
    if (following) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_user_id", user.id)
        .eq("followed_user_id", targetUserId);
      if (error) toast.error(error.message);
      else setFollowing(false);
    } else {
      const { data: me } = await supabase
        .from("profiles")
        .select("display_name,username,avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      const { error } = await supabase
        .from("follows")
        .insert({ follower_user_id: user.id, followed_user_id: targetUserId });
      if (error) toast.error(error.message);
      else {
        setFollowing(true);
        if (roomId) {
          // Best-effort live toast to the followed user inside the workshop.
          const ch = supabase.channel(`instant:${roomId}`);
          ch.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              ch.send({
                type: "broadcast",
                event: "follow",
                payload: {
                  follower_id: user.id,
                  followed_id: targetUserId,
                  display_name: me?.display_name ?? me?.username ?? "Someone",
                  avatar_url: me?.avatar_url ?? null,
                },
              }).finally(() => supabase.removeChannel(ch));
            }
          });
        }
      }
    }
    setLoading(false);
  }

  return (
    <Button
      onClick={toggle}
      disabled={loading}
      variant={following ? "outline" : "default"}
      className="rounded-full gap-1.5"
    >
      {following ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {following ? "Following" : "Follow"}
    </Button>
  );
}
