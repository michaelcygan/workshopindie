import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SignupGateModal } from "@/components/signup-gate-modal";
import { joinGroup, leaveGroup } from "@/lib/groups.functions";

/**
 * Quick Join/Leave pill for a group — mirrors FollowButton so a viewer can
 * jump into a group directly from a tag peek without opening the group page.
 */
export function JoinGroupButton({
  groupId,
  groupName,
}: {
  groupId: string;
  groupName?: string;
}) {
  const { user } = useAuth();
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const pendingAfterAuthRef = useRef(false);
  const join = useServerFn(joinGroup);
  const leave = useServerFn(leaveGroup);

  useEffect(() => {
    if (!user) {
      setJoined(false);
      return;
    }
    supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setJoined(!!data));
  }, [user, groupId]);

  useEffect(() => {
    if (!user || !pendingAfterAuthRef.current) return;
    pendingAfterAuthRef.current = false;
    void doJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function doJoin() {
    setLoading(true);
    try {
      await join({ data: { group_id: groupId } });
      setJoined(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't join group");
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    if (!user) {
      pendingAfterAuthRef.current = true;
      setGateOpen(true);
      return;
    }
    if (joined) {
      setLoading(true);
      try {
        await leave({ data: { group_id: groupId } });
        setJoined(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't leave group");
      } finally {
        setLoading(false);
      }
      return;
    }
    await doJoin();
  }

  return (
    <>
      <Button
        onClick={toggle}
        disabled={loading}
        variant={joined ? "outline" : "default"}
        className="rounded-full gap-1.5"
      >
        {joined ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {joined ? "Joined" : "Join"}
      </Button>
      <SignupGateModal
        open={gateOpen}
        onOpenChange={(v) => {
          setGateOpen(v);
          if (!v) pendingAfterAuthRef.current = false;
        }}
        title={groupName ? `Join ${groupName}` : "Join this group"}
        subtitle="Create your free account to join groups and follow along."
      />
    </>
  );
}
