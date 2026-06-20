import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { ArrowLeft, RadioTower, Rocket, Sparkles, ArrowRight, X } from "lucide-react";
import { mediumIcon } from "@/lib/medium-icons";
import { CreateCollabNudge } from "@/components/create-collab-nudge";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { ChannelView } from "@/components/channel-view";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createCollabFromRoom, acceptWorkshopJoinInvite, declineWorkshopJoinInvite } from "@/lib/collab-workshop.functions";
import { startHostClaim } from "@/lib/host-room.functions";
import { WorkshopToolsPanel, ComposerToolButton } from "@/components/workshop-tools-panel";
import { HostFirstRunTour } from "@/components/host-first-run-tour";
import { WaitingForOthersCard } from "@/components/waiting-for-others-card";
import { FocusStrip } from "@/components/focus-strip";
import { HostedByLine } from "@/components/hosted-by-line";
import { HostMenu } from "@/components/host-menu";
import { HopButton } from "@/components/hop-button";
import { HostRoomEvents } from "@/components/host-room-events";
import { ClaimHostPill } from "@/components/claim-host-pill";
import { BecomeHostNudge } from "@/components/become-host-nudge";
import { LicenseChip } from "@/components/license-chip";
import { toast } from "sonner";
import { formatRoomTitle } from "@/lib/instant";

const searchSchema = z.object({ mode: z.enum(["voice", "video"]).optional() });
const FALLBACK_TITLE = "Workshop";

export const Route = createFileRoute("/workshop/$id")({
  component: () => <RequireAuth><LiveRoomPage /></RequireAuth>,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Workshop" },
      { name: "description", content: "A live Workshop. Drop in, talk shop, find your people." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-ink">Couldn't load this Workshop</h1>
        <p className="mt-2 text-sm text-ink-muted">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 rounded-full border border-border px-4 py-2 text-sm hover:bg-surface">Try again</button>
      </main>
    );
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">This Workshop isn't here</h1>
      <p className="mt-2 text-ink-muted">It may have ended or the link is wrong.</p>
      <Link to="/workshop" className="mt-6 inline-block rounded-full border border-border px-4 py-2 text-sm hover:bg-surface">Back to Workshop</Link>
    </main>
  ),
});

type Room = {
  id: string;
  title: string;
  kind: string;
  medium: string | null;
  category: string | null;
  host_user_id: string | null;
  promoted_at: string | null;
  source_workshop_id: string | null;
  status: string;
  focus_message: string | null;
  locked: boolean;
  ended_by_user_id: string | null;
  workshop_id: string | null;
  claim_user_id: string | null;
  claim_started_at: string | null;
  claim_vetoed: boolean | null;
};

function LiveRoomPage() {
  const { id } = Route.useParams();
  const { mode } = Route.useSearch();
  const { user, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [collabOpen, setCollabOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  const { data: room, isFetched } = useQuery({
    queryKey: ["instant-room", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instant_rooms")
        .select("id, title, kind, medium, category, host_user_id, promoted_at, source_workshop_id, status, focus_message, locked, ended_by_user_id, workshop_id, claim_user_id, claim_started_at, claim_vetoed")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as Room | null) ?? null;
    },
    refetchInterval: 5000,
  });

  // Bad room ID → trigger the notFound boundary instead of a blank live-room shell.
  if (isFetched && room === null) throw notFound();



  // Pending opt-in invite for the persistent fork
  const { data: invite } = useQuery({
    queryKey: ["wji", room?.source_workshop_id, user?.id],
    enabled: !!user && !!room?.source_workshop_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("workshop_join_invites")
        .select("workshop_id, status")
        .eq("workshop_id", room!.source_workshop_id!)
        .eq("invitee_user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  // Persistent fork slug, when promoted
  const { data: forkedWs } = useQuery({
    queryKey: ["forked-ws", room?.source_workshop_id],
    enabled: !!room?.source_workshop_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("workshops")
        .select("id, slug, title")
        .eq("id", room!.source_workshop_id!)
        .maybeSingle();
      return data;
    },
  });

  const title = formatRoomTitle(room?.title, room?.medium) || FALLBACK_TITLE;
  const isHost = !!user && !!room && room.host_user_id === user.id;
  const isLeaderless = !!room && !room.host_user_id;
  const isPromoted = !!room?.promoted_at;
  const isEnded = !!room && room.status !== "active";
  const claimHostFn = useServerFn(startHostClaim);
  const canClaimHost = !!user && !!room && room.status === "active" && !room.host_user_id && !isHost;
  async function handleClaimHost() {
    if (!room) return;
    try {
      await claimHostFn({ data: { roomId: id } });
      toast("Claiming host — others have 10s to object.");
      qc.invalidateQueries({ queryKey: ["instant-room", id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't claim host");
    }
  }

  // If the room is ended/archived and you're not the host, bounce home.
  // Host stays so they can wrap up gracefully.
  useEffect(() => {
    if (!room || isPromoted || isHost) return;
    if (isEnded) {
      toast("This Workshop ended.");
      router.navigate({ to: "/workshop" });
    }
  }, [room, isEnded, isHost, isPromoted, router]);

  // Stash this room so /workshop can offer a quick "Rejoin" pill for 60s.
  // Skip when ended/locked — no point offering a rejoin into a dead room.
  useEffect(() => {
    if (typeof window === "undefined" || !id || isPromoted) return;
    return () => {
      if (isEnded || room?.locked) return;
      try {
        window.sessionStorage.setItem(
          "workshop:last-room",
          JSON.stringify({ id, title, leftAt: Date.now() }),
        );
      } catch {
        // ignore
      }
    };
  }, [id, title, isPromoted, isEnded, room?.locked]);

  // First-Workshop receipt — one-time gentle toast on the user's first join.
  useEffect(() => {
    if (typeof window === "undefined" || !user || !room?.id || isPromoted) return;
    try {
      if (window.localStorage.getItem("ws:first_done") === "1") return;
      window.localStorage.setItem("ws:first_done", "1");
      const t = setTimeout(() => toast.success("First Workshop — nicely done."), 1200);
      return () => clearTimeout(t);
    } catch {
      // ignore
    }
  }, [user, room?.id, isPromoted]);

  // Keyboard shortcut: "N" hops to next Workshop (guests only).
  useEffect(() => {
    if (!user || !room || isHost || isPromoted || room.status !== "active") return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "n" && e.key !== "N") return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (e.target as HTMLElement | null)?.isContentEditable) return;
      const btn = document.querySelector<HTMLButtonElement>('[data-hop-button]');
      btn?.click();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user, room, isHost, isPromoted]);

  // Live presence count for the "waiting for others" nudge.
  const { data: liveCount = 0 } = useQuery({
    queryKey: ["instant-room-live-count", id],
    enabled: !!user && !isPromoted,
    refetchInterval: 5000,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { count } = await supabase
        .from("instant_presence")
        .select("user_id", { count: "exact", head: true })
        .eq("room_id", id)
        .gt("last_seen_at", cutoff);
      return count ?? 0;
    },
  });

  // Other participants (for the host's Remove picker). Only fetched when host.
  const { data: participants = [] } = useQuery({
    queryKey: ["instant-room-participants", id, isHost],
    enabled: !!user && isHost,
    refetchInterval: 8000,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { data } = await supabase
        .from("instant_presence")
        .select("user_id, profile:profiles!instant_presence_user_id_fkey(display_name, username, avatar_url)")
        .eq("room_id", id)
        .gt("last_seen_at", cutoff);
      return ((data ?? []) as Array<{
        user_id: string;
        profile: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
      }>)
        .filter((p) => p.user_id !== user!.id)
        .map((p) => ({
          user_id: p.user_id,
          display_name: p.profile?.display_name ?? null,
          username: p.profile?.username ?? null,
          avatar_url: p.profile?.avatar_url ?? null,
        }));
    },
  });

  const { data: claimantName = null } = useQuery({
    queryKey: ["claim-host-name", room?.claim_user_id],
    enabled: !!room?.claim_user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", room!.claim_user_id!)
        .maybeSingle();
      return (data?.display_name as string | null) ?? (data?.username as string | null) ?? null;
    },
  });


  const acceptInvite = useServerFn(acceptWorkshopJoinInvite);
  const declineInvite = useServerFn(declineWorkshopJoinInvite);

  async function onAcceptInvite() {
    if (!room?.source_workshop_id) return;
    try {
      const { workshopSlug } = await acceptInvite({ data: { workshopId: room.source_workshop_id } });
      if (workshopSlug) router.navigate({ to: "/workshops/$slug", params: { slug: workshopSlug } });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't accept");
    }
  }
  async function onDeclineInvite() {
    if (!room?.source_workshop_id) return;
    await declineInvite({ data: { workshopId: room.source_workshop_id } });
    qc.invalidateQueries({ queryKey: ["wji", room.source_workshop_id, user?.id] });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <Link to="/workshop" className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink md:hidden">
            <ArrowLeft className="h-3 w-3" /> Workshop
          </Link>
          {/* Hide the redundant fallback "Workshop" title on desktop — top nav already shows it.
              When the room has a custom name (after a purpose pick), the title stays. */}
          {(() => {
            const MediumIcon = mediumIcon(room?.medium ?? room?.category ?? null);
            const isFallback = title === FALLBACK_TITLE;
            return (
              <h1
                className={
                  "mt-0.5 flex min-w-0 items-center gap-2 font-display text-xl text-ink md:text-2xl" +
                  (isFallback ? " md:hidden" : "")
                }
              >
                <span className="gradient-motion inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-primary-foreground">
                  <MediumIcon className="h-3.5 w-3.5" />
                </span>
                <span className="truncate">{title}</span>
              </h1>
            );
          })()}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Live · {liveCount}/5
            </span>
            <span className="text-ink-muted/40">·</span>
            {isHost ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet/30 bg-violet/5 px-1.5 py-0.5 font-medium text-violet">
                <RadioTower className="h-3 w-3" /> Hosting
              </span>
            ) : isLeaderless && !isPromoted && user ? (
              <ClaimHostPill
                roomId={id}
                viewerId={user.id}
                unclaimable={room?.status !== "active"}
                claimUserId={room?.claim_user_id ?? null}
                claimStartedAt={room?.claim_started_at ?? null}
                claimantName={claimantName}
                onChanged={() => qc.invalidateQueries({ queryKey: ["instant-room", id] })}
              />
            ) : null}
            <span className="text-ink-muted/40">·</span>
            <LicenseChip />
          </div>
        </div>

        {!isPromoted && user && (
          <div className="flex items-center gap-2">
            {!isHost && room?.status === "active" && (
              <HopButton
                roomId={id}
                medium={(room?.medium as any) ?? null}
                mode={mode ?? "video"}
              />
            )}
            {isHost && room && (
              <HostMenu
                roomId={id}
                hostUserId={user.id}
                title={room.title || FALLBACK_TITLE}
                focusMessage={room.focus_message}
                locked={!!room.locked}
                participants={participants}
                onChanged={() => qc.invalidateQueries({ queryKey: ["instant-room", id] })}
              />
            )}
            <Button
              size="sm"
              onClick={() => setCollabOpen(true)}
              className="rounded-full gap-1.5"
            >
              <Rocket className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Create a Collab</span>
            </Button>
          </div>
        )}
      </div>

      {/* Hosted by + lock badge — sits just under the title row */}
      {!isPromoted && room?.host_user_id && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <HostedByLine hostUserId={room.host_user_id} />
          {room.locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-ink-soft">
              Locked
            </span>
          )}
        </div>
      )}

      {/* Focus message — visible to everyone; host sees a ghost CTA when empty */}
      {!isPromoted && (
        <FocusStrip
          text={room?.focus_message ?? null}
          isHost={isHost}
          onHostSet={() => window.dispatchEvent(new CustomEvent("workshop:open-focus", { detail: { roomId: id } }))}
        />
      )}

      {/* Realtime listener for host broadcasts (mute_all, kick, ended) */}
      {user && <HostRoomEvents roomId={id} isHost={isHost} />}

      {/* Promoted banner — slim */}
      {isPromoted && forkedWs && (
        <div className="mt-3 rounded-xl border border-violet/30 bg-violet/5 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Sparkles className="h-3.5 w-3.5 text-violet shrink-0" />
            <span className="text-ink truncate">This Workshop became a Collab: "{forkedWs.title}".</span>
            <Link to="/workshops/$slug" params={{ slug: forkedWs.slug }} className="ml-auto">
              <Button size="sm" variant="outline" className="rounded-full gap-1 h-7">
                Open <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          {invite && invite.status === "pending" && (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-violet/20 pt-2">
              <span className="text-xs text-ink-soft">You've been invited to join the persistent Workshop.</span>
              <Button size="sm" onClick={onAcceptInvite} className="rounded-full h-7">Join</Button>
              <Button size="sm" variant="ghost" onClick={onDeclineInvite} className="rounded-full h-7">No thanks</Button>
            </div>
          )}
        </div>
      )}

      <ChannelView
        key={id}
        roomId={id}
        title={title}
        hostUserId={room?.host_user_id ?? null}
        medium={(room?.medium as any) ?? (room?.category as any) ?? null}
        initialMode={mode ?? "video"}

        toolsSlot={(media) => (
          <WorkshopToolsPanel
            scope={{
              kind: "instant",
              roomId: id,
              hostUserId: room?.host_user_id ?? null,
              category: (room?.category as any) ?? (room?.medium as any) ?? null,
            }}
            media={media}
          />
        )}

        composerLeading={
          <ComposerToolButton
            scope={{
              kind: "instant",
              roomId: id,
              hostUserId: room?.host_user_id ?? null,
              category: (room?.category as any) ?? (room?.medium as any) ?? null,
            }}
          />
        }
      />

      <WaitingForOthersCard
        roomId={id}
        visible={!isPromoted && liveCount <= 1}
        canPingMutuals={isHost}
        filledSeats={Math.max(1, liveCount)}
        viewerInitials={(user?.email ?? "?").slice(0, 1).toUpperCase()}
      />

      <CreateCollabSheet
        open={collabOpen}
        onOpenChange={setCollabOpen}
        roomId={id}
        defaultTitle={title}
        onCreated={(slug) => {
          qc.invalidateQueries({ queryKey: ["instant-room", id] });
          router.navigate({ to: "/workshops/$slug", params: { slug } });
        }}
      />

      <HostFirstRunTour active={isHost && !isPromoted} />

      {user && !isPromoted && (
        <BecomeHostNudge
          roomId={id}
          viewerId={user.id}
          isEligibleRoom={
            !!room &&
            room.status === "active" &&
            !room.host_user_id &&
            !room.claim_user_id
          }
        />
      )}
      {!isPromoted && (
        <CreateCollabNudge
          roomId={id}
          visible={!!user && (isHost || isLeaderless) && liveCount >= 1}
          onCreate={() => setCollabOpen(true)}
          onClaimHost={handleClaimHost}
          canClaimHost={canClaimHost}
        />
      )}
    </main>
  );
}

type LicenseChoice = "cc_by" | "rights_managed_externally" | "portfolio_credit_only" | "private";

const LICENSE_OPTIONS: Array<{ id: LicenseChoice; label: string; hint: string }> = [
  { id: "cc_by", label: "Creative Commons (BY 4.0)", hint: "Free to use with credit. Matches the Workshop spirit." },
  { id: "portfolio_credit_only", label: "Credit only / custom", hint: "Anyone may reference with attribution." },
  { id: "rights_managed_externally", label: "Rights managed externally", hint: "Terms handled outside the platform." },
  { id: "private", label: "Closed circle", hint: "Just the co-creators. Nothing public." },
];

function CreateCollabSheet({
  open, onOpenChange, roomId, defaultTitle, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roomId: string;
  defaultTitle: string;
  onCreated: (workshopSlug: string) => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState(defaultTitle);
  const [pitch, setPitch] = useState("");
  const [license, setLicense] = useState<LicenseChoice>("cc_by");
  const [licenseCustom, setLicenseCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createCollabFromRoom);

  const { data: meName } = useQuery({
    queryKey: ["create-collab-me-name", user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name, username").eq("id", user!.id).maybeSingle();
      return (data?.display_name as string | null) ?? (data?.username as string | null) ?? "Host";
    },
  });

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setPitch("");
      setLicense("cc_by");
      setLicenseCustom("");
    }
  }, [open, defaultTitle]);

  const attributionLabel =
    license === "rights_managed_externally" ? "Rights managed externally"
    : license === "portfolio_credit_only" ? (licenseCustom.trim() ? `Credit — ${licenseCustom.trim()}` : "Credit only")
    : license === "private" ? "Closed circle"
    : "CC BY 4.0";

  async function submit() {
    if (!title.trim()) return toast.error("Give it a title");
    setBusy(true);
    try {
      const { workshopSlug } = await create({
        data: {
          roomId,
          title: title.trim(),
          pitch: pitch.trim() || undefined,
          license,
          licenseCustom: license === "portfolio_credit_only" && licenseCustom.trim() ? licenseCustom.trim() : undefined,
        },
      });
      if (!workshopSlug) throw new Error("Couldn't create the Collab");
      toast.success("Collab created — everyone in the room got an opt-in invite.");
      onOpenChange(false);
      onCreated(workshopSlug);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create the Collab");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-violet" /> Create a Collab
          </DialogTitle>
          <DialogDescription>
            Fork this live Workshop into a persistent one. You'll be the host. Everyone currently in the room gets a one-tap invite — no one is auto-added.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-soft">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-soft">What is this Collab about?</label>
            <Textarea value={pitch} onChange={(e) => setPitch(e.target.value)} rows={3} maxLength={2000}
              placeholder="A sentence or two so newcomers know what they're walking into."
              className="mt-1" />
          </div>

          <div className="rounded-2xl border border-border bg-surface-2/40 p-3">
            <div className="flex items-baseline justify-between">
              <label className="text-xs font-medium text-ink-soft">Rights</label>
              <span className="text-[10px] uppercase tracking-[0.16em] text-ink-muted">Default · CC BY 4.0</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {LICENSE_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 transition ${
                    license === opt.id ? "border-primary/60 bg-primary/5" : "border-border hover:bg-surface"
                  }`}
                >
                  <input
                    type="radio"
                    name="license"
                    className="mt-1 accent-primary"
                    checked={license === opt.id}
                    onChange={() => setLicense(opt.id)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{opt.label}</span>
                    <span className="block text-[11px] text-ink-muted">{opt.hint}</span>
                  </span>
                </label>
              ))}
              {license === "portfolio_credit_only" && (
                <Input
                  value={licenseCustom}
                  onChange={(e) => setLicenseCustom(e.target.value)}
                  placeholder="e.g. Free for personal use, ask for commercial"
                  maxLength={400}
                  className="mt-2"
                />
              )}
            </div>
            <p className="mt-3 truncate rounded-lg bg-surface px-2 py-1.5 text-[11px] text-ink-soft">
              <span className="text-ink-muted">Attribution preview · </span>
              <span className="text-ink">“{title || "Untitled"}” by {meName ?? "Host"} · {attributionLabel}</span>
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="gap-2">
            <Rocket className="h-4 w-4" /> {busy ? "Creating…" : "Create Collab"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
