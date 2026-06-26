import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Megaphone, UserPlus, Send, Pin, PinOff, ChevronUp, ChevronDown } from "lucide-react";
import { CollabPeek } from "@/components/collab-peek";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CategoryChip } from "@/components/category-chip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { inviteToCollab } from "@/lib/collab-invites.functions";
import { pinCollab, unpinCollab, reorderHostPins } from "@/lib/room-pins.functions";
import type { Category } from "@/lib/categories";
import { toast } from "sonner";

type PresenceUser = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type CollabRow = {
  id: string;
  title: string;
  slug: string;
  category: Category;
  description: string | null;
  user_id: string;
  roles: { id: string; role_name: string; quantity: number }[];
};

type PinRow = {
  id: string;
  collab_post_id: string;
  pinned_by_user_id: string;
  is_host_pin: boolean;
  sort_order: number;
  created_at: string;
};

export function WorkshopCollabsPanel({
  presenceUsers,
  roomId,
  hostUserId,
}: {
  presenceUsers: PresenceUser[];
  roomId?: string;
  hostUserId?: string | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userIds = useMemo(() => presenceUsers.map((p) => p.user_id), [presenceUsers]);
  const usersById = useMemo(
    () => new Map(presenceUsers.map((p) => [p.user_id, p])),
    [presenceUsers],
  );
  const isHost = !!user && !!hostUserId && user.id === hostUserId;

  const { data: collabs = [], isLoading } = useQuery({
    queryKey: ["workshop-collabs", userIds.sort().join(",")],
    queryFn: async (): Promise<CollabRow[]> => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from("collab_posts")
        .select("id,title,slug,category,description,user_id,roles:collab_roles(id,role_name,quantity,sort_order)")
        .in("user_id", userIds)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        roles: (r.roles ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      }));
    },
    enabled: userIds.length > 0,
  });

  // Pins
  const pinsKey = ["room-pins", roomId ?? ""];
  const { data: pins = [] } = useQuery({
    queryKey: pinsKey,
    queryFn: async (): Promise<PinRow[]> => {
      if (!roomId) return [];
      const { data, error } = await supabase
        .from("instant_room_pins")
        .select("id,collab_post_id,pinned_by_user_id,is_host_pin,sort_order,created_at")
        .eq("room_id", roomId);
      if (error) throw error;
      return data as PinRow[];
    },
    enabled: !!roomId,
  });

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room-pins:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instant_room_pins", filter: `room_id=eq.${roomId}` },
        () => qc.invalidateQueries({ queryKey: pinsKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Index helpers
  const pinByCollabId = useMemo(() => {
    const m = new Map<string, PinRow>();
    pins.forEach((p) => m.set(p.collab_post_id, p));
    return m;
  }, [pins]);
  const myGuestPin = useMemo(
    () => (user ? pins.find((p) => !p.is_host_pin && p.pinned_by_user_id === user.id) ?? null : null),
    [pins, user],
  );

  const collabsById = useMemo(() => {
    const m = new Map<string, CollabRow>();
    collabs.forEach((c) => m.set(c.id, c));
    return m;
  }, [collabs]);

  const orderedPins = useMemo(() => {
    const hostPins = pins
      .filter((p) => p.is_host_pin)
      .sort((a, b) => a.sort_order - b.sort_order);
    const guestPins = pins
      .filter((p) => !p.is_host_pin)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return [...hostPins, ...guestPins].filter((p) => collabsById.has(p.collab_post_id));
  }, [pins, collabsById]);

  // Mutations
  const pinFn = useServerFn(pinCollab);
  const unpinFn = useServerFn(unpinCollab);
  const reorderFn = useServerFn(reorderHostPins);

  const doPin = useMutation({
    mutationFn: (collabPostId: string) => {
      if (!roomId) throw new Error("Room not ready");
      return pinFn({ data: { roomId, collabPostId } });
    },
    onSuccess: () => {
      toast.success("Pinned");
      qc.invalidateQueries({ queryKey: pinsKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doUnpin = useMutation({
    mutationFn: (pinId: string) => unpinFn({ data: { pinId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: pinsKey }),
    onError: (e: Error) => toast.error(e.message),
  });

  const doReorder = useMutation({
    mutationFn: (orderedIds: string[]) => {
      if (!roomId) throw new Error("Room not ready");
      return reorderFn({ data: { roomId, orderedIds } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: pinsKey }),
    onError: (e: Error) => toast.error(e.message),
  });

  const moveHostPin = (collabPostId: string, dir: -1 | 1) => {
    const hostIds = orderedPins.filter((p) => p.is_host_pin).map((p) => p.id);
    const pin = pinByCollabId.get(collabPostId);
    if (!pin) return;
    const idx = hostIds.indexOf(pin.id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= hostIds.length) return;
    const next = [...hostIds];
    [next[idx], next[target]] = [next[target], next[idx]];
    doReorder.mutate(next);
  };

  // Replace-confirm flow for guests
  const [confirmReplaceFor, setConfirmReplaceFor] = useState<string | null>(null);

  const handlePinClick = (collabPostId: string) => {
    if (!roomId) return;
    if (!isHost && myGuestPin && myGuestPin.collab_post_id !== collabPostId) {
      setConfirmReplaceFor(collabPostId);
      return;
    }
    doPin.mutate(collabPostId);
  };

  // Apply (non-owner) — same shape as collab page contact event
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyCollab, setApplyCollab] = useState<CollabRow | null>(null);
  const [applyRoleId, setApplyRoleId] = useState<string | null>(null);
  const [applyMsg, setApplyMsg] = useState("");
  const [peekId, setPeekId] = useState<string | null>(null);
  const [peekOpen, setPeekOpen] = useState(false);
  const openPeek = (id: string) => { setPeekId(id); setPeekOpen(true); };

  const sendApply = useMutation({
    mutationFn: async () => {
      if (!user || !applyCollab) throw new Error("Sign in to apply");
      const { error } = await supabase.from("collab_contact_events").insert({
        collab_post_id: applyCollab.id,
        collab_role_id: applyRoleId,
        sender_user_id: user.id,
        message_preview: applyMsg.slice(0, 280),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application sent");
      setApplyOpen(false); setApplyMsg(""); setApplyRoleId(null); setApplyCollab(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Invite (owner)
  const invite = useServerFn(inviteToCollab);
  const sendInvite = useMutation({
    mutationFn: async (vars: { collabPostId: string; roleId: string | null; inviteeUserId: string }) =>
      invite({ data: vars }),
    onSuccess: () => {
      toast.success("Invite sent");
      qc.invalidateQueries({ queryKey: ["workshop-collabs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return null;

  const renderPinButton = (collabId: string) => {
    if (!roomId) return null;
    const existing = pinByCollabId.get(collabId);
    if (existing) {
      const canUnpin = isHost || existing.pinned_by_user_id === user.id;
      if (!canUnpin) {
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-[11px] text-ink-muted">
            <Pin className="h-3 w-3" /> Pinned
          </span>
        );
      }
      return (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 rounded-full gap-1 text-xs"
          onClick={() => doUnpin.mutate(existing.id)}
          disabled={doUnpin.isPending}
        >
          <PinOff className="h-3 w-3" /> Unpin
        </Button>
      );
    }
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-7 rounded-full gap-1 text-xs"
        onClick={() => handlePinClick(collabId)}
        disabled={doPin.isPending}
      >
        <Pin className="h-3 w-3" /> Pin
      </Button>
    );
  };

  return (
    <div className="space-y-3">
      {orderedPins.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-muted">
            <Pin className="h-3.5 w-3.5 text-primary" />
            <span>Pinned · {orderedPins.length}</span>
          </div>
          <ul className="space-y-2">
            {orderedPins.map((p, i) => {
              const c = collabsById.get(p.collab_post_id)!;
              const owner = usersById.get(c.user_id);
              const pinnedBy = usersById.get(p.pinned_by_user_id);
              const canUnpin = isHost || p.pinned_by_user_id === user.id;
              const hostPinsCount = orderedPins.filter((x) => x.is_host_pin).length;
              const hostIdx = orderedPins.filter((x) => x.is_host_pin).findIndex((x) => x.id === p.id);
              return (
                <li key={p.id} className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-start gap-2">
                    <CategoryChip category={c.category} />
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => openPeek(c.id)} className="block text-left font-medium text-ink hover:underline">
                        {c.title}
                      </button>
                      <p className="truncate text-xs text-ink-muted">
                        by {owner?.display_name || owner?.username || "Someone"}
                        {p.is_host_pin ? " · pinned by host" : pinnedBy ? ` · pinned by ${pinnedBy.display_name || pinnedBy.username || "someone"}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {isHost && p.is_host_pin && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={hostIdx <= 0 || doReorder.isPending}
                            onClick={() => moveHostPin(c.id, -1)}
                            aria-label="Move up"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={hostIdx < 0 || hostIdx >= hostPinsCount - 1 || doReorder.isPending}
                            onClick={() => moveHostPin(c.id, 1)}
                            aria-label="Move down"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {canUnpin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 rounded-full gap-1 text-xs"
                          onClick={() => doUnpin.mutate(p.id)}
                          disabled={doUnpin.isPending}
                        >
                          <PinOff className="h-3 w-3" /> Unpin
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Hide the order index unused warning */}
                  <span className="hidden">{i}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <Megaphone className="h-4 w-4 text-primary" />
        <span>Collabs from people in this Lounge</span>
      </div>

      {isLoading ? (
        <div className="h-20 animate-pulse rounded-xl bg-surface-2" />
      ) : collabs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-ink-muted">
          No open Collabs from people here yet.{" "}
          <Link to="/collab/new" className="text-gradient-motion underline">Post one</Link>.
        </div>
      ) : (
        <ul className="space-y-2">
          {collabs.map((c) => {
            const owner = usersById.get(c.user_id);
            const isOwnerMe = c.user_id === user.id;
            const otherUsers = presenceUsers.filter((p) => p.user_id !== user.id);
            return (
              <li key={c.id} className="rounded-xl border border-border bg-surface p-3">
                <div className="flex items-start gap-2">
                  <CategoryChip category={c.category} />
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => openPeek(c.id)} className="block text-left font-medium text-ink hover:underline">
                      {c.title}
                    </button>
                    <p className="truncate text-xs text-ink-muted">
                      by {owner?.display_name || owner?.username || "Someone"}
                    </p>
                  </div>
                  <div className="shrink-0">{renderPinButton(c.id)}</div>
                </div>

                {c.roles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.roles.map((r) => (
                      isOwnerMe ? (
                        <DropdownMenu key={r.id}>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 rounded-full gap-1 text-xs">
                              <UserPlus className="h-3 w-3" /> Invite to {r.role_name}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56">
                            <DropdownMenuLabel className="text-xs">Invite someone here</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {otherUsers.length === 0 ? (
                              <DropdownMenuItem disabled>Only you in this Lounge</DropdownMenuItem>
                            ) : otherUsers.map((p) => (
                              <DropdownMenuItem
                                key={p.user_id}
                                onClick={() => sendInvite.mutate({ collabPostId: c.id, roleId: r.id, inviteeUserId: p.user_id })}
                              >
                                {p.display_name || p.username || "Anon"}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Button
                          key={r.id}
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full gap-1 text-xs"
                          onClick={() => {
                            setApplyCollab(c); setApplyRoleId(r.id); setApplyOpen(true);
                          }}
                        >
                          <Send className="h-3 w-3" /> Apply: {r.role_name}
                        </Button>
                      )
                    ))}
                  </div>
                )}

                {isOwnerMe && (
                  <div className="mt-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 rounded-full gap-1 text-xs text-ink-muted">
                          <UserPlus className="h-3 w-3" /> General invite
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel className="text-xs">General invite (no specific role)</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {presenceUsers.filter((p) => p.user_id !== user.id).map((p) => (
                          <DropdownMenuItem
                            key={p.user_id}
                            onClick={() => sendInvite.mutate({ collabPostId: c.id, roleId: null, inviteeUserId: p.user_id })}
                          >
                            {p.display_name || p.username || "Anon"}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!confirmReplaceFor} onOpenChange={(o) => !o && setConfirmReplaceFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your pin?</AlertDialogTitle>
            <AlertDialogDescription>
              You can only pin one Collab in this Workshop. Pinning this one will unpin your current pick.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmReplaceFor) doPin.mutate(confirmReplaceFor);
                setConfirmReplaceFor(null);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Apply to {applyCollab?.roles.find((r) => r.id === applyRoleId)?.role_name ?? "this Collab"}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            rows={5}
            value={applyMsg}
            onChange={(e) => setApplyMsg(e.target.value)}
            placeholder="Quick intro: who you are, why this caught your eye, links to your work…"
          />
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button
              className="rounded-full"
              disabled={!applyMsg.trim() || sendApply.isPending}
              onClick={() => sendApply.mutate()}
            >
              {sendApply.isPending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CollabPeek collabId={peekId} open={peekOpen} onOpenChange={setPeekOpen} />
    </div>
  );
}
