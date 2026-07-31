import { useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radio, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { listMyLoungeInvites, respondToLoungeInvite } from "@/lib/friends.functions";
import { formatRoomTitle } from "@/lib/instant";

/**
 * "You're invited" strip on the Lounge index. Shows pending invitations to
 * still-live rooms so an invite never dies in the notification tray.
 */
export function LoungeInvitesStrip() {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const listFn = useServerFn(listMyLoungeInvites);
  const respondFn = useServerFn(respondToLoungeInvite);

  const { data: invites = [] } = useQuery({
    queryKey: ["lounge-invites", user?.id ?? null],
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: () => listFn(),
  });

  const respond = useMutation({
    mutationFn: (vars: { inviteId: string; action: "accept" | "decline" }) =>
      respondFn({ data: vars }),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["lounge-invites"] });
      if (vars.action === "accept" && res?.roomId) {
        router.navigate({ to: "/lounge/$id", params: { id: res.roomId }, search: { mode: "chat" } });
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "Couldn't respond to that invite"),
  });

  if (!user || invites.length === 0) return null;

  return (
    <section className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-primary">
        <Radio className="h-3.5 w-3.5" /> You're invited
      </div>
      <ul className="space-y-2">
        {invites.map((inv) => (
          <li
            key={inv.id}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2"
          >
            {inv.inviterAvatar ? (
              <img
                src={inv.inviterAvatar}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">
                <span className="font-medium">{inv.inviterName ?? "Someone"}</span> invited you in
              </p>
              <p className="truncate text-[11px] text-ink-muted">
                {formatRoomTitle(inv.title, inv.medium) || "Lounge"}
              </p>
            </div>
            <button
              type="button"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ inviteId: inv.id, action: "accept" })}
              className="shrink-0 rounded-full bg-primary px-3 py-1 text-[12px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Join
            </button>
            <button
              type="button"
              aria-label="Dismiss invite"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ inviteId: inv.id, action: "decline" })}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-muted/50 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
