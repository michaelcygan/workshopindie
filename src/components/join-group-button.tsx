import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { joinGroup, leaveGroup } from "@/lib/groups.functions";
import { ParentGroupPrompt } from "@/components/parent-group-prompt";
import { toast } from "sonner";

export function useIsMemberOfGroup(groupId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["group-membership", groupId, user?.id ?? "anon"],
    enabled: !!groupId && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("group_id", groupId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
    staleTime: 30_000,
  });
}

/**
 * Join/leave button for a group. When the group is nested inside a parent
 * and the viewer isn't already in the parent, prompts to also join the
 * parent after a successful join.
 */
export function JoinGroupButton({
  groupId,
  parent,
  size = "default",
  variant = "default",
}: {
  groupId: string;
  parent?: { id: string; name: string } | null;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost";
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: isMember, isLoading } = useIsMemberOfGroup(groupId);
  const { data: isParentMember } = useIsMemberOfGroup(parent?.id);
  const joinFn = useServerFn(joinGroup);
  const leaveFn = useServerFn(leaveGroup);
  const [showParentPrompt, setShowParentPrompt] = useState(false);

  const join = useMutation({
    mutationFn: () => joinFn({ data: { group_id: groupId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group-membership", groupId] });
      qc.invalidateQueries({ queryKey: ["my-group-ids"] });
      qc.invalidateQueries({ queryKey: ["my-groups"] });
      qc.invalidateQueries({ queryKey: ["group", groupId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Joined");
      if (parent && !isParentMember) setShowParentPrompt(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leave = useMutation({
    mutationFn: () => leaveFn({ data: { group_id: groupId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group-membership", groupId] });
      qc.invalidateQueries({ queryKey: ["my-group-ids"] });
      qc.invalidateQueries({ queryKey: ["my-groups"] });
      qc.invalidateQueries({ queryKey: ["group", groupId] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast("Left group");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) {
    return (
      <Link to="/login">
        <Button size={size} variant={variant} className="rounded-full gap-1.5">
          <Plus className="h-4 w-4" /> Join
        </Button>
      </Link>
    );
  }

  if (isLoading) {
    return (
      <Button size={size} variant={variant} disabled className="rounded-full gap-1.5">
        …
      </Button>
    );
  }

  return (
    <>
      {isMember ? (
        <Button
          size={size}
          variant="outline"
          className="rounded-full gap-1.5"
          onClick={() => leave.mutate()}
          disabled={leave.isPending}
        >
          <Check className="h-4 w-4" /> Joined
        </Button>
      ) : (
        <Button
          size={size}
          variant={variant}
          className="rounded-full gap-1.5"
          onClick={() => join.mutate()}
          disabled={join.isPending}
        >
          <Plus className="h-4 w-4" /> Join
        </Button>
      )}
      <ParentGroupPrompt
        open={showParentPrompt}
        onOpenChange={setShowParentPrompt}
        parent={parent ?? null}
      />
    </>
  );
}
