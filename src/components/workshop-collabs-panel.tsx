import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Megaphone, UserPlus, Send, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CategoryChip } from "@/components/category-chip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { inviteToCollab } from "@/lib/collab-invites.functions";
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

export function WorkshopCollabsPanel({ presenceUsers }: { presenceUsers: PresenceUser[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userIds = useMemo(() => presenceUsers.map((p) => p.user_id), [presenceUsers]);
  const usersById = useMemo(
    () => new Map(presenceUsers.map((p) => [p.user_id, p])),
    [presenceUsers],
  );

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

  // Apply (non-owner) — same shape as collab page contact event
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyCollab, setApplyCollab] = useState<CollabRow | null>(null);
  const [applyRoleId, setApplyRoleId] = useState<string | null>(null);
  const [applyMsg, setApplyMsg] = useState("");

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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <Megaphone className="h-4 w-4 text-primary" />
        <span>Collabs from people in this Workshop</span>
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
                    <Link to="/collab/$slug" params={{ slug: c.slug }} className="block font-medium text-ink hover:underline">
                      {c.title}
                    </Link>
                    <p className="truncate text-xs text-ink-muted">
                      by {owner?.display_name || owner?.username || "Someone"}
                    </p>
                  </div>
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
                              <DropdownMenuItem disabled>Only you in this Workshop</DropdownMenuItem>
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
    </div>
  );
}
