import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { joinGroup, leaveGroup } from "@/lib/groups.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  groupId: string;
  joined?: boolean;
  className?: string;
};

/**
 * Always-visible, keyboard-reachable Join / Joined control.
 * - Owns auth handling, join/leave mutation, loading, toasts, invalidation.
 * - Never rendered inside a parent <Link>; card puts it as a sibling absolute
 *   element to avoid nested interactive descendants.
 */
export function GroupCardActions({ groupId, joined, className }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const joinFn = useServerFn(joinGroup);
  const leaveFn = useServerFn(leaveGroup);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["group-membership", groupId] });
    qc.invalidateQueries({ queryKey: ["my-group-ids"] });
    qc.invalidateQueries({ queryKey: ["group", groupId] });
    qc.invalidateQueries({ queryKey: ["groups"] });
  };

  const join = useMutation({
    mutationFn: () => joinFn({ data: { group_id: groupId } }),
    onSuccess: () => {
      invalidate();
      toast.success("Joined");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leave = useMutation({
    mutationFn: () => leaveFn({ data: { group_id: groupId } }),
    onSuccess: () => {
      invalidate();
      toast("Left group");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = join.isPending || leave.isPending;

  const baseClass =
    "inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:opacity-60";

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => navigate({ to: "/login" })}
        aria-label="Sign in to join this group"
        className={cn(baseClass, "bg-ink text-background hover:bg-ink/90", className)}
      >
        <Plus className="h-3.5 w-3.5" /> Join
      </button>
    );
  }

  if (joined) {
    return (
      <button
        type="button"
        onClick={() => leave.mutate()}
        disabled={busy}
        aria-label="Leave this group"
        className={cn(
          baseClass,
          "border border-border bg-background text-ink-soft hover:bg-muted",
          className,
        )}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Joined
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => join.mutate()}
      disabled={busy}
      aria-label="Join this group"
      className={cn(baseClass, "bg-ink text-background hover:bg-ink/90", className)}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
      Join
    </button>
  );
}
