import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Video, Loader2, ArrowLeft, Crown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { joinLounge, joinMediumLounge, hostInstantWorkshop, type RoomVisibility } from "@/lib/instant.functions";
import { LiveTopicsList } from "@/components/live-topics-list";
import { WorkshopStrip } from "@/components/workshop-strip";
import { LiveWorkshopsRail } from "@/components/live-workshops-rail";
import { HostPrivacyDialog } from "@/components/host-privacy-dialog";
import { CATEGORIES, type Category } from "@/lib/categories";
import { toast } from "sonner";

export const Route = createFileRoute("/workshop/")({
  component: WorkshopPreflight,
  head: () => ({
    meta: [
      { title: "Workshop — Drop in or host" },
      { name: "description", content: "Drop into a live Workshop or host your own. Voice or video, up to 5 per Workshop." },
    ],
  }),
});

function WorkshopPreflight() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const drop = useServerFn(joinLounge);
  const dropMedium = useServerFn(joinMediumLounge);
  const host = useServerFn(hostInstantWorkshop);
  const [busy, setBusy] = useState<"drop" | "host" | null>(null);
  const [devices, setDevices] = useState<{ mic: boolean; cam: boolean } | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [selectedMediumLive, setSelectedMediumLive] = useState(0);
  const [selectedDropMedium, setSelectedDropMedium] = useState<Category | null>(null);
  const [hostMedium, setHostMedium] = useState<Category | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const dropLabel = selectedDropMedium ? CATEGORIES.find((c) => c.id === selectedDropMedium)?.label ?? null : null;
  const hostLabel = hostMedium ? CATEGORIES.find((c) => c.id === hostMedium)?.label ?? null : null;

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  useEffect(() => {
    let cancelled = false;
    async function detect() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) {
          if (!cancelled) setDevices({ mic: false, cam: false });
          return;
        }
        const list = await navigator.mediaDevices.enumerateDevices();
        const mic = list.some((d) => d.kind === "audioinput");
        const cam = list.some((d) => d.kind === "videoinput");
        if (!cancelled) setDevices({ mic, cam });
      } catch {
        if (!cancelled) setDevices({ mic: false, cam: false });
      }
    }
    detect();
    navigator.mediaDevices?.addEventListener?.("devicechange", detect);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.("devicechange", detect);
    };
  }, []);

  const canDrop = !!devices && (devices.mic || devices.cam);

  const preGrantMedia = useCallback(async (): Promise<"video" | "voice" | null> => {
    if (!devices) return null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: devices.mic,
        video: devices.cam,
      });
      for (const t of stream.getTracks()) t.stop();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Permission denied";
      toast.error(`Couldn't access ${devices.cam && !devices.mic ? "camera" : "mic"}: ${msg}`);
      return null;
    }
    return devices.cam ? "video" : "voice";
  }, [devices]);

  async function handleDrop() {
    if (busy || !canDrop) return;
    setBusy("drop");
    try {
      const mode = await preGrantMedia();
      if (!mode) { setBusy(null); return; }
      const { roomId } = selectedDropMedium
        ? await dropMedium({ data: { medium: selectedDropMedium } })
        : await drop();
      router.navigate({ to: "/workshop/$id", params: { id: roomId }, search: { mode } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't drop in");
      setBusy(null);
    }
  }

  function handleHost() {
    if (busy || !canDrop) return;
    setPrivacyOpen(true);
  }

  async function confirmHost(args: { title: string; visibility: RoomVisibility; medium: Category | null }) {
    if (busy || !canDrop) return;
    setBusy("host");
    try {
      const mode = await preGrantMedia();
      if (!mode) { setBusy(null); return; }
      const { roomId } = await host({
        data: {
          medium: args.medium ?? null,
          title: args.title || null,
          visibility: args.visibility,
        },
      });
      qc.invalidateQueries({ queryKey: ["instant-active-rooms"] });
      setPrivacyOpen(false);
      router.navigate({ to: "/workshop/$id", params: { id: roomId }, search: { mode } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open your Workshop");
      setBusy(null);
    }
  }

  async function handleJoinNow(medium: Category) {
    if (busy || !canDrop) return;
    setSelectedDropMedium(medium);
    setBusy("drop");
    try {
      const mode = await preGrantMedia();
      if (!mode) { setBusy(null); return; }
      const { roomId } = await dropMedium({ data: { medium } });
      router.navigate({ to: "/workshop/$id", params: { id: roomId }, search: { mode } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open that Workshop");
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-16">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
        <h1 className="font-display text-4xl md:text-5xl text-ink flex flex-wrap items-baseline gap-x-3">
          Workshop
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <span className="relative inline-flex h-2 w-2">
              <span className="gradient-motion absolute inset-0 animate-ping rounded-full opacity-75" />
              <span className="gradient-motion relative inline-flex h-2 w-2 rounded-full" />
            </span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={liveCount} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -6, opacity: 0 }} transition={{ duration: 0.18 }} className="tabular-nums">
                {liveCount}
              </motion.span>
            </AnimatePresence>
            <span>live</span>
          </span>
        </h1>
        <p className="mt-3 text-lg text-ink-muted max-w-2xl">
          Drop into a live one, or spin up your own. Voice or video, up to 5 per Workshop. Anyone in the room can turn it into a Collab when there's something worth shipping.
        </p>

        <div className="mt-5 flex items-center gap-4 text-xs">
          {devices === null ? (
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking devices…
            </span>
          ) : (
            <>
              <span className={`inline-flex items-center gap-1.5 ${devices.mic ? "text-ink" : "text-ink-muted opacity-60"}`}>
                <Mic className="h-3.5 w-3.5" /> {devices.mic ? "Mic ready" : "No mic"}
              </span>
              <span className={`inline-flex items-center gap-1.5 ${devices.cam ? "text-ink" : "text-ink-muted opacity-60"}`}>
                <Video className="h-3.5 w-3.5" /> {devices.cam ? "Camera ready" : "No camera"}
              </span>
            </>
          )}
        </div>
        {devices && !canDrop && (
          <p className="mt-2 text-xs text-destructive">Connect a mic or camera to continue.</p>
        )}
      </motion.div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {/* Drop in card */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-3xl border border-border bg-surface p-6 shadow-soft flex flex-col">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-muted">
            <Radio className="h-3.5 w-3.5" /> Drop in
          </div>
          <h2 className="mt-2 font-display text-2xl text-ink">Take a seat in a live one</h2>
          <p className="mt-2 text-sm text-ink-soft">Matchmaker drops you into an open Workshop with a seat — and prefers rooms hosted by people you follow. Leaderless, focused.</p>
          <div className="mt-4">
            <LoungeForkDropdown
              selectedMedium={selectedDropMedium}
              onSelectMedium={setSelectedDropMedium}
              onJoinNow={handleJoinNow}
              onLiveCountChange={setLiveCount}
              onSelectedMediumLiveChange={setSelectedMediumLive}
            />
          </div>
          <div className="mt-auto pt-4">
            <Button onClick={handleDrop} disabled={!canDrop || busy !== null} className="w-full rounded-2xl h-12 gap-2">
              {busy === "drop" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
              {busy === "drop"
                ? "Finding you a seat…"
                : selectedDropMedium
                  ? (selectedMediumLive > 0
                      ? `Drop into ${dropLabel} (${selectedMediumLive} live)`
                      : `Open the first ${dropLabel} room`)
                  : (liveCount > 0
                      ? `Drop in (${liveCount} live)`
                      : "Open the first room")}
            </Button>
          </div>
        </motion.div>

        {/* Host card */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-3xl border border-border bg-surface p-6 shadow-soft flex flex-col">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-muted">
            <Crown className="h-3.5 w-3.5" /> Host
          </div>
          <h2 className="mt-2 font-display text-2xl text-ink">Spin up your own room</h2>
          <p className="mt-2 text-sm text-ink-soft">You hold host controls. Share the link, invite collaborators, and turn it into a Collab when there's something worth shipping.</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <button onClick={() => setHostMedium(null)}
              className={"rounded-full px-3 py-1 text-xs transition " + (hostMedium === null ? "bg-ink text-background" : "border border-border text-ink-soft hover:text-ink")}>
              Open topic
            </button>
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setHostMedium(c.id)}
                className={"rounded-full px-3 py-1 text-xs transition " + (hostMedium === c.id ? "bg-ink text-background" : "border border-border text-ink-soft hover:text-ink")}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="mt-auto pt-4">
            <Button onClick={handleHost} disabled={!canDrop || busy !== null} variant="outline" className="w-full rounded-2xl h-12 gap-2 border-ink/30 hover:border-ink/60">
              {busy === "host" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              {busy === "host" ? "Opening your room…" : hostLabel ? `Open my ${hostLabel} room` : "Open my room"}
            </Button>
          </div>
        </motion.div>
      </div>

      <p className="mt-4 text-center text-xs text-ink-muted">
        Cap 5 per room. Everything in a live room is ephemeral until someone creates a Collab from it.
      </p>

      <LiveWorkshopsRail
        canJoin={canDrop && busy === null}
        medium={selectedDropMedium}
        onTakeSeat={async (roomId) => {
          const mode = await preGrantMedia();
          router.navigate({ to: "/workshop/$id", params: { id: roomId }, search: { mode: mode ?? "video" } });
        }}
      />

      <HostPrivacyDialog
        open={privacyOpen}
        onOpenChange={setPrivacyOpen}
        defaultMedium={hostMedium}
        busy={busy === "host"}
        onConfirm={confirmHost}
      />



      <WorkshopStrip />
    </main>
  );
}
