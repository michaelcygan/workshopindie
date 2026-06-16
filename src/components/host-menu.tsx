import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Crown, Target, Lock, Unlock, UserMinus, StopCircle, Megaphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  setRoomFocusMessage,
  setRoomLocked,
  removeFromRoom,
  endRoom,
} from "@/lib/host-room.functions";
import { toast } from "sonner";

type Participant = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Props = {
  roomId: string;
  hostUserId: string;
  focusMessage: string | null;
  locked: boolean;
  participants: Participant[]; // excludes the host
  onChanged: () => void;
};

export function HostMenu({ roomId, hostUserId, focusMessage, locked, participants, onChanged }: Props) {
  const qc = useQueryClient();
  const setFocus = useServerFn(setRoomFocusMessage);
  const setLocked = useServerFn(setRoomLocked);
  const removeOne = useServerFn(removeFromRoom);
  const endIt = useServerFn(endRoom);

  const [focusOpen, setFocusOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [draftFocus, setDraftFocus] = useState(focusMessage ?? "");

  useEffect(() => {
    if (focusOpen) setDraftFocus(focusMessage ?? "");
  }, [focusOpen, focusMessage]);

  function broadcast(event: string, payload: Record<string, unknown>) {
    supabase.channel(`instant-host:${roomId}`).send({
      type: "broadcast",
      event,
      payload,
    });
  }

  async function onSetFocus() {
    setBusy("focus");
    try {
      const text = draftFocus.trim().slice(0, 140);
      await setFocus({ data: { roomId, text: text.length > 0 ? text : null } });
      onChanged();
      setFocusOpen(false);
      toast.success(text ? "Focus set" : "Focus cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update focus");
    } finally {
      setBusy(null);
    }
  }

  async function onToggleLock() {
    setBusy("lock");
    try {
      const next = !locked;
      await setLocked({ data: { roomId, locked: next } });
      onChanged();
      toast.success(next ? "Room locked — no new seats fill" : "Room unlocked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update lock");
    } finally {
      setBusy(null);
    }
  }

  async function onMuteAll() {
    broadcast("mute_all", { from: hostUserId });
    toast.success("Asked everyone to mute");
  }

  async function onRemove(targetUserId: string, name: string) {
    setBusy(`remove:${targetUserId}`);
    try {
      await removeOne({ data: { roomId, targetUserId } });
      broadcast("kick", { target_user_id: targetUserId });
      qc.invalidateQueries({ queryKey: ["instant-room-live-count", roomId] });
      onChanged();
      toast.success(`Removed ${name}. They can rejoin in 30 minutes.`);
      if (participants.length <= 1) setRemoveOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove");
    } finally {
      setBusy(null);
    }
  }

  async function onEnd() {
    setBusy("end");
    try {
      broadcast("ended", { from: hostUserId });
      await endIt({ data: { roomId } });
      onChanged();
      setEndOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't end Workshop");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="rounded-full gap-1.5">
            <Crown className="h-3.5 w-3.5 text-violet" />
            <span className="hidden sm:inline">Host</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-ink-muted">
            Host controls
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setFocusOpen(true)} className="gap-2">
            <Target className="h-4 w-4" />
            {focusMessage ? "Edit focus message" : "Set focus message"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onMuteAll} className="gap-2">
            <Megaphone className="h-4 w-4" />
            Ask all to mute
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setRemoveOpen(true)}
            disabled={participants.length === 0}
            className="gap-2"
          >
            <UserMinus className="h-4 w-4" />
            Remove someone…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleLock} className="gap-2">
            {locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {locked ? "Unlock room" : "Lock room"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setEndOpen(true)}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <StopCircle className="h-4 w-4" />
            End Workshop for all
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Focus message dialog */}
      <Dialog open={focusOpen} onOpenChange={(o) => !busy && setFocusOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Set focus message
            </DialogTitle>
            <DialogDescription>
              Everyone in the room sees this at the top. Up to 140 characters.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={draftFocus}
            onChange={(e) => setDraftFocus(e.target.value)}
            maxLength={140}
            placeholder="e.g. Workshopping ch. 2 — read first, then react."
          />
          <p className="text-[11px] text-ink-muted tabular-nums text-right">
            {draftFocus.length}/140
          </p>
          <DialogFooter className="gap-2">
            {focusMessage && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDraftFocus("");
                  setFocus({ data: { roomId, text: null } }).then(() => {
                    onChanged();
                    setFocusOpen(false);
                    toast.success("Focus cleared");
                  });
                }}
                disabled={!!busy}
              >
                Clear
              </Button>
            )}
            <Button variant="ghost" onClick={() => setFocusOpen(false)} disabled={!!busy}>
              Cancel
            </Button>
            <Button onClick={onSetFocus} disabled={!!busy} className="gap-2">
              {busy === "focus" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove picker */}
      <Dialog open={removeOpen} onOpenChange={(o) => !busy && setRemoveOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserMinus className="h-4 w-4 text-destructive" /> Remove someone
            </DialogTitle>
            <DialogDescription>
              They leave the Workshop and can't rejoin for 30 minutes. Only affects this room.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            {participants.length === 0 ? (
              <p className="text-sm text-ink-muted py-4 text-center">
                No one else is in the room.
              </p>
            ) : (
              participants.map((p) => {
                const name = p.display_name || p.username || "Anon";
                const isBusy = busy === `remove:${p.user_id}`;
                return (
                  <button
                    key={p.user_id}
                    type="button"
                    disabled={!!busy}
                    onClick={() => onRemove(p.user_id, name)}
                    className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-left hover:border-destructive/50 hover:bg-destructive/5 transition disabled:opacity-50"
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <span className="h-7 w-7 rounded-full bg-muted" />
                    )}
                    <span className="flex-1 min-w-0 truncate text-sm text-ink">{name}</span>
                    {isBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                    ) : (
                      <span className="text-[11px] text-destructive">Remove</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveOpen(false)} disabled={!!busy}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End workshop confirm */}
      <AlertDialog open={endOpen} onOpenChange={(o) => !busy && setEndOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this Workshop for everyone?</AlertDialogTitle>
            <AlertDialogDescription>
              Everyone in the room will see a wrap screen. The room is archived. You can always spin up a new one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onEnd}
              disabled={!!busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy === "end" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              End Workshop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
