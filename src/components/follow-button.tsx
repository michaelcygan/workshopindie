import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, Plus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export function FollowButton({ targetUserId }: { targetUserId: string }) {
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
      const { error } = await supabase
        .from("follows")
        .insert({ follower_user_id: user.id, followed_user_id: targetUserId });
      if (error) toast.error(error.message);
      else setFollowing(true);
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
