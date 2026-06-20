import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getFriends } from "@/lib/friends.functions";
import { FriendRow } from "@/components/friend-row";
import { InviteToWorkshopDialog } from "@/components/invite-to-workshop-dialog";

export const Route = createFileRoute("/me/friends")({
  component: MyFriendsPage,
  head: () => ({
    meta: [
      { title: "Your Network — Workshop" },
      { name: "description", content: "Mutual follows, online status, and one-tap invites to Workshops." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function MyFriendsPage() {
  const { user, loading } = useAuth();
  const getFriendsFn = useServerFn(getFriends);
  const { data: friends, isLoading } = useQuery({
    queryKey: ["my-friends"],
    queryFn: () => getFriendsFn(),
    enabled: !!user,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const [invitee, setInvitee] = useState<{ id: string; displayName: string | null; username: string | null } | null>(null);

  if (loading) return null;

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-display text-3xl text-ink">Your Network</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Sign in to see your mutual follows and invite them into Workshops.
        </p>
        <Link to="/auth" className="mt-4 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
          Sign in
        </Link>
      </main>
    );
  }

  const online = (friends ?? []).filter((f) => f.online);
  const offline = (friends ?? []).filter((f) => !f.online);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-5">
        <h1 className="font-display text-3xl text-ink">Your Network</h1>
        <p className="mt-1 text-sm text-ink-muted">
          People you follow who follow you back. The green dot means online right now.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : (friends?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-ink-muted" />
          <h2 className="mt-3 text-base font-medium text-ink">Your network is empty</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Follow people back to grow your network — invites flow from here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {online.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                Online now · {online.length}
              </h2>
              <div className="space-y-2">
                {online.map((f) => (
                  <FriendRow
                    key={f.user_id}
                    friend={f}
                    inviteLabel="Invite to Workshop"
                    onInviteClick={() =>
                      setInvitee({ id: f.user_id, displayName: f.display_name, username: f.username })
                    }
                  />
                ))}
              </div>
            </section>
          )}
          {offline.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                Offline · {offline.length}
              </h2>
              <div className="space-y-2">
                {offline.map((f) => (
                  <FriendRow
                    key={f.user_id}
                    friend={f}
                    inviteLabel="Invite to Workshop"
                    onInviteClick={() =>
                      setInvitee({ id: f.user_id, displayName: f.display_name, username: f.username })
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {invitee && (
        <InviteToWorkshopDialog
          open={!!invitee}
          onOpenChange={(o) => !o && setInvitee(null)}
          invitee={invitee}
        />
      )}
    </main>
  );
}
