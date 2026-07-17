import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { SignupGateModal } from "@/components/signup-gate-modal";


export function FollowButton({
  targetUserId,
  /** When set, broadcasts a follow notification on `instant:{roomId}` so the
   * followed user sees a live toast inside the workshop. */
  roomId,
  /** Optional label override, e.g. "Follow back" when the target already follows you. */
  followLabel,
  /** Optional display name for the signup CTA copy. */
  targetName,
  /** When true and the viewer already follows, render an icon-only pill
   * (person + check) to signal mutual/following in a compact header row. */
  compact = false,
}: {
  targetUserId: string;
  roomId?: string;
  followLabel?: string;
  targetName?: string;
  compact?: boolean;
}) {

  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  // Replay follow once the user authenticates via the gate.
  const pendingAfterAuthRef = useRef(false);

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

  // After SignupGateModal auths the user, follow on next render.
  useEffect(() => {
    if (!user || !pendingAfterAuthRef.current) return;
    pendingAfterAuthRef.current = false;
    void doFollow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (user?.id === targetUserId) return null;

  async function doFollow() {
    if (!user) return;
    setLoading(true);
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
    setLoading(false);
  }

  async function toggle() {
    if (!user) {
      pendingAfterAuthRef.current = true;
      setGateOpen(true);
      return;
    }
    setLoading(true);
    if (following) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_user_id", user.id)
        .eq("followed_user_id", targetUserId);
      if (error) toast.error(error.message);
      else setFollowing(false);
      setLoading(false);
    } else {
      await doFollow();
    }
  }

  return (
    <>
      {compact && following ? (
        <Button
          onClick={toggle}
          disabled={loading}
          variant="outline"
          size="sm"
          aria-label="Following — tap to unfollow"
          title="Following"
          className="rounded-full gap-1 px-2.5"
        >
          <UserRound className="h-3.5 w-3.5" />
          <Check className="h-3.5 w-3.5 text-primary" />
        </Button>
      ) : (
        <Button
          onClick={toggle}
          disabled={loading}
          variant={following ? "outline" : "default"}
          className="rounded-full gap-1.5"
        >
          {following ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {following ? "Following" : (followLabel ?? "Follow")}
        </Button>
      )}

      <SignupGateModal
        open={gateOpen}
        onOpenChange={(v) => {
          setGateOpen(v);
          if (!v) pendingAfterAuthRef.current = false;
        }}
        title={targetName ? `Follow ${targetName}` : "Follow this creator"}
        subtitle="Create your free account to follow people and get notified when they post new work."
      />
    </>
  );
}
