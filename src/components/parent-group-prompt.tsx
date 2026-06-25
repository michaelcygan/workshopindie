import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { joinGroup } from "@/lib/groups.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Asks the user whether they'd also like to join the parent group after
 * joining a nested child group. Used by JoinGroupButton.
 */
export function ParentGroupPrompt({
  open,
  onOpenChange,
  parent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent: { id: string; name: string } | null;
}) {
  const qc = useQueryClient();
  const joinFn = useServerFn(joinGroup);

  const join = useMutation({
    mutationFn: () => joinFn({ data: { group_id: parent!.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-group-ids"] });
      qc.invalidateQueries({ queryKey: ["my-groups"] });
      qc.invalidateQueries({ queryKey: ["group-membership", parent!.id] });
      toast.success(`Joined ${parent!.name}`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!parent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Also join {parent.name}?</DialogTitle>
          <DialogDescription>
            This group lives inside {parent.name}. Join the parent too to see everything happening across it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">
            Not now
          </Button>
          <Button
            onClick={() => join.mutate()}
            disabled={join.isPending}
            className="rounded-full"
            autoFocus
          >
            {join.isPending ? "Joining…" : `Join ${parent.name}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
