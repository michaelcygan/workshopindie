import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { joinGroup, leaveGroup } from "@/lib/groups.functions";
import { toast } from "sonner";

type Props = { groupId: string; joined?: boolean };

/**
 * Hover-revealed Join / Joined pill on group cards (desktop).
 * Stops propagation so the parent card link doesn't intercept.
 */
export function GroupCardActions({ groupId, joined }: Props) {
  const { user } = useAuth();
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

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div
      className="pointer-events-none absolute right-2 top-2 z-10 translate-y-1 opacity-0 transition group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100"
      onClick={stop}
    >
      {!user ? (
        <Link
          to="/login"
          onClick={stop}
          className="inline-flex items-center gap-1 rounded-full bg-ink/90 px-2.5 py-1 text-[11px] font-medium text-background shadow-soft backdrop-blur transition hover:bg-ink"
        >
          <Plus className="h-3 w-3" /> Join
        </Link>
      ) : joined ? (
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            leave.mutate();
          }}
          disabled={leave.isPending}
          className="inline-flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-[11px] font-medium text-ink shadow-soft backdrop-blur transition hover:bg-background"
        >
          <Check className="h-3 w-3" /> Joined
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            join.mutate();
          }}
          disabled={join.isPending}
          className="inline-flex items-center gap-1 rounded-full bg-ink/90 px-2.5 py-1 text-[11px] font-medium text-background shadow-soft backdrop-blur transition hover:bg-ink"
        >
          <Plus className="h-3 w-3" /> Join
        </button>
      )}
    </div>
  );
}
