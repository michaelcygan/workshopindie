import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getFriends } from "@/lib/friends.functions";
import { FriendRow } from "@/components/friend-row";
import { InviteToWorkshopDialog } from "@/components/invite-to-workshop-dialog";

type Props = {
  workshopId: string;
};

/**
 * Host-only panel inside a Workshop: surface mutual-follow friends (online
 * first) with a one-tap invite that hits workshop_join_invites.
 * Excludes existing participants and pending invitees.
 */
export function InviteFriendsPanel({ workshopId }: Props) {
  const getFriendsFn = useServerFn(getFriends);
  const [invitee, setInvitee] = useState<{ id: string; displayName: string | null; username: string | null } | null>(null);

  const { data: friends } = useQuery({
    queryKey: ["my-friends"],
    queryFn: () => getFriendsFn(),
  });

  const { data: excludeIds } = useQuery({
    queryKey: ["workshop-invite-excludes", workshopId],
    queryFn: async () => {
      const [{ data: parts }, { data: inv }] = await Promise.all([
        supabase.from("workshop_participants").select("user_id").eq("workshop_id", workshopId),
        supabase.from("workshop_join_invites").select("invitee_user_id").eq("workshop_id", workshopId).eq("status", "pending"),
      ]);
      const set = new Set<string>();
      (parts ?? []).forEach((r) => set.add(r.user_id));
      (inv ?? []).forEach((r) => set.add(r.invitee_user_id));
      return set;
    },
  });

  const available = (friends ?? []).filter((f) => !excludeIds?.has(f.user_id));
  const online = available.filter((f) => f.online);
  const offline = available.filter((f) => !f.online).slice(0, 6);

  if (available.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-violet" />
        <h3 className="text-sm font-semibold text-ink">Invite friends</h3>
        {online.length > 0 && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
            {online.length} online now
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Mutual follows you can invite straight to this Workshop.
      </p>

      <div className="mt-3 space-y-2">
        {[...online, ...offline].map((f) => (
          <FriendRow
            key={f.user_id}
            friend={f}
            inviteLabel="Invite"
            onInviteClick={() =>
              setInvitee({ id: f.user_id, displayName: f.display_name, username: f.username })
            }
          />
        ))}
      </div>

      {invitee && (
        <InviteToWorkshopDialog
          open={!!invitee}
          onOpenChange={(o) => !o && setInvitee(null)}
          invitee={invitee}
        />
      )}
    </section>
  );
}
