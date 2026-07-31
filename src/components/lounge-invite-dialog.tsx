import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Radio, Sparkles } from "lucide-react";
import { listMyLoungeRooms, inviteFriendToLounge } from "@/lib/friends.functions";
import { formatRoomTitle } from "@/lib/instant";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invitee: { id: string; displayName: string | null; username: string | null };
};

/**
 * Invite a mutual follow into a specific live Lounge room. The invitation is
 * bound to the room id, so the notification deep-links into that exact room.
 */
export function LoungeInviteDialog({ open, onOpenChange, invitee }: Props) {
  const listFn = useServerFn(listMyLoungeRooms);
  const inviteFn = useServerFn(inviteFriendToLounge);
  const navigate = useNavigate();
  const [pickedId, setPickedId] = useState<string | null>(null);

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["my-live-lounge-rooms"],
    queryFn: () => listFn(),
    enabled: open,
  });

  const invite = useMutation({
    mutationFn: async (roomId: string) => inviteFn({ data: { roomId, inviteeId: invitee.id } }),
    onSuccess: () => {
      toast.success(`Invited ${invitee.displayName ?? invitee.username ?? "them"}`);
      onOpenChange(false);
      setPickedId(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't send invite."),
  });

  const hasAny = (rooms?.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite {invitee.displayName ?? invitee.username ?? "them"}</DialogTitle>
          <DialogDescription>
            Pick a Lounge you're in right now, or open a new one together.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : hasAny ? (
            rooms!.map((r) => {
              const active = pickedId === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setPickedId(r.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                    active ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  }`}
                >
                  <Radio className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {formatRoomTitle(r.title, r.medium)}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      {r.groupName ? `${r.groupName} · live now` : "Live now"}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-ink-muted">
              You aren't in a live Lounge. Open one to invite them.
            </div>
          )}
        </div>

        <DialogFooter className="mt-3 gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {hasAny ? (
            <Button
              onClick={() => pickedId && invite.mutate(pickedId)}
              disabled={!pickedId || invite.isPending}
            >
              {invite.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Send invite
            </Button>
          ) : (
            <Button
              onClick={() => {
                onOpenChange(false);
                navigate({ to: "/lounge" });
              }}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Open a Lounge
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
