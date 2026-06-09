import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Lock, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listMyLobbies, listDiscoverableLobbies, requestToJoinLobby, type LobbyCard } from "@/lib/lobby.functions";
import { acceptWorkshopJoinInvite, declineWorkshopJoinInvite } from "@/lib/collab-workshop.functions";

function Avatar({ url, name, size = 24 }: { url: string | null; name: string | null; size?: number }) {
  return (
    <div className="overflow-hidden rounded-full bg-surface-2" style={{ width: size, height: size }}>
      {url ? <img src={url} alt={name ?? ""} className="h-full w-full object-cover" /> : null}
    </div>
  );
}

function Card({ l, action }: { l: LobbyCard; action: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface p-4 transition hover:bg-surface-2">
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-2 py-0.5 text-ink-soft">
          {l.invite_status === "host" ? <Sparkles className="h-3 w-3" /> :
           l.invite_status === "discoverable" ? <Eye className="h-3 w-3" /> :
           l.invite_status === "pending" ? <Users className="h-3 w-3" /> :
           <Users className="h-3 w-3" />}
          {l.invite_status === "host" ? "You're hosting" :
           l.invite_status === "discoverable" ? "Open draft" :
           l.invite_status === "pending" ? "Invited" : "Joined"}
        </span>
        <span className="inline-flex items-center gap-1 text-ink-muted">
          {l.lobby_discoverable ? <Eye className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Draft</span>
          {l.member_count} {l.member_count === 1 ? "member" : "members"}
        </span>
      </div>
      <h3 className="mt-2 font-display text-xl leading-snug text-ink">{l.title}</h3>
      {l.prompt && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{l.prompt}</p>}
      <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
        <Avatar url={l.host_avatar_url} name={l.host_display_name} />
        <span className="truncate">{l.host_display_name ?? l.host_username ?? "Host"}</span>
      </div>
      <div className="mt-4">{action}</div>
    </div>
  );
}

export function LobbiesSection() {
  const qc = useQueryClient();
  const fetchMine = useServerFn(listMyLobbies);
  const fetchDisc = useServerFn(listDiscoverableLobbies);
  const acceptFn = useServerFn(acceptWorkshopJoinInvite);
  const declineFn = useServerFn(declineWorkshopJoinInvite);
  const requestFn = useServerFn(requestToJoinLobby);

  const mine = useQuery({ queryKey: ["my-lobbies"], queryFn: () => fetchMine(), staleTime: 30_000 });
  const discoverable = useQuery({ queryKey: ["discoverable-lobbies"], queryFn: () => fetchDisc(), staleTime: 30_000 });

  const accept = useMutation({
    mutationFn: (workshopId: string) => acceptFn({ data: { workshopId } }),
    onSuccess: (res) => {
      toast.success("Joined the draft");
      qc.invalidateQueries({ queryKey: ["my-lobbies"] });
      if (res?.workshopSlug) window.location.assign(`/workshops/${res.workshopSlug}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't accept"),
  });
  const decline = useMutation({
    mutationFn: (workshopId: string) => declineFn({ data: { workshopId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-lobbies"] }); },
  });
  const request = useMutation({
    mutationFn: (workshopId: string) => requestFn({ data: { workshopId } }),
    onSuccess: () => toast.success("Request sent — the host will see it"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't send request"),
  });

  const lobbies = mine.data ?? [];
  const open = discoverable.data ?? [];
  const loading = mine.isLoading || discoverable.isLoading;
  const empty = !loading && lobbies.length === 0 && open.length === 0;

  if (empty) return null;

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl text-ink">Draft Workshops</h2>
          <p className="text-sm text-ink-muted">Private Workshops you're brainstorming with people you mutually follow. Schedule one when you're ready.</p>
        </div>
        <Link to="/workshops/lobby/new"><Button size="sm" variant="outline" className="rounded-full gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Start a Draft</Button></Link>
      </div>

      <div className={cn("mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", loading && "opacity-60")}>
        {lobbies.map((l) => (
          <Card key={l.id} l={l} action={
            l.invite_status === "pending" ? (
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 rounded-full" disabled={accept.isPending} onClick={() => accept.mutate(l.id)}>Accept</Button>
                <Button size="sm" variant="ghost" className="rounded-full" disabled={decline.isPending} onClick={() => decline.mutate(l.id)}>Decline</Button>
              </div>
            ) : (
              <Link to="/workshops/$slug" params={{ slug: l.slug }}>
                <Button size="sm" variant="outline" className="w-full rounded-full">Open</Button>
              </Link>
            )
          } />
        ))}
        {open.map((l) => (
          <Card key={l.id} l={l} action={
            <Button size="sm" variant="outline" className="w-full rounded-full" disabled={request.isPending} onClick={() => request.mutate(l.id)}>
              Ask to join
            </Button>
          } />
        ))}
      </div>
    </section>
  );
}
