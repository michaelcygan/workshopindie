import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SignupGateModal } from "@/components/signup-gate-modal";
import { ParentGroupPrompt } from "@/components/parent-group-prompt";
import { joinGroup, leaveGroup } from "@/lib/groups.functions";

/**
 * Shared membership hook — any surface that renders a Join affordance can
 * read from this cache so a click in one place updates every other Join
 * pill for the same group.
 */
export function useIsMemberOfGroup(groupId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["group-membership", groupId] as const,
    enabled: !!user && !!groupId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!user || !groupId) return false;
      const { data } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle();
      return !!data;
    },
  });
}

/**
 * Quick Join/Leave pill for a group — mirrors FollowButton so a viewer can
 * jump into a group directly from a tag peek without opening the group page.
 * When the group has a parent, prompts to also join the parent after joining.
 */
export function JoinGroupButton({
  groupId,
  groupName,
  parent,
}: {
  groupId: string;
  groupName?: string;
  parent?: { id: string; name: string } | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const joinFn = useServerFn(joinGroup);
  const leaveFn = useServerFn(leaveGroup);
  const { data: joined = false } = useIsMemberOfGroup(groupId);
  const [gateOpen, setGateOpen] = useState(false);
  const [parentPromptOpen, setParentPromptOpen] = useState(false);
  const pendingAfterAuthRef = useRef(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["group-membership", groupId] });
    qc.invalidateQueries({ queryKey: ["my-group-ids"] });
    qc.invalidateQueries({ queryKey: ["my-groups"] });
  };

  const join = useMutation({
    mutationFn: () => joinFn({ data: { group_id: groupId } }),
    onSuccess: () => {
      invalidate();
      if (parent) setParentPromptOpen(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leave = useMutation({
    mutationFn: () => leaveFn({ data: { group_id: groupId } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!user || !pendingAfterAuthRef.current) return;
    pendingAfterAuthRef.current = false;
    join.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function toggle() {
    if (!user) {
      pendingAfterAuthRef.current = true;
      setGateOpen(true);
      return;
    }
    if (joined) leave.mutate();
    else join.mutate();
  }

  const loading = join.isPending || leave.isPending;

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
      {parent && (
        <ParentGroupPrompt
          open={parentPromptOpen}
          onOpenChange={setParentPromptOpen}
          parent={parent}
        />
      )}
    </>
  );
}
