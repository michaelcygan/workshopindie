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
import { cn } from "@/lib/utils";
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
  const [busyMedium, setBusyMedium] = useState<string | null>(null);
  const [devices, setDevices] = useState<{ mic: boolean; cam: boolean } | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [hostMedium] = useState<Category | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
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

  async function handlePick(medium: Category | null) {
    if (busy) return;
    if (!canDrop) {
      toast.error("Connect a mic or camera to continue.");
      return;
    }
    setBusy("drop");
    setBusyMedium(medium ?? "any");
    try {
      const mode = await preGrantMedia();
      if (!mode) { setBusy(null); setBusyMedium(null); return; }
      const { roomId } = medium
        ? await dropMedium({ data: { medium } })
        : await drop();
      router.navigate({ to: "/workshop/$id", params: { id: roomId }, search: { mode } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open that room");
      setBusy(null);
      setBusyMedium(null);
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

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
      {/* Single compact header bar */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            aria-label="Home"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-muted/40 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-ink-muted/40">·</span>
          <h1 className="font-display text-2xl md:text-[28px] leading-none text-ink truncate">
            Workshop
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
            <span className="relative inline-flex h-2 w-2">
              {liveCount > 0 && (
                <span className="gradient-motion absolute inset-0 animate-ping rounded-full opacity-75" />
              )}
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  liveCount > 0 ? "gradient-motion" : "border border-ink/20",
                )}
              />
            </span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={liveCount}
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -6, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="tabular-nums"
              >
                {liveCount}
              </motion.span>
            </AnimatePresence>
            <span>live</span>
          </div>

          <span className="h-4 w-px bg-border/70" aria-hidden />

          <div className="inline-flex items-center gap-2 text-xs">
            {devices === null ? (
              <Loader2 className="h-3 w-3 animate-spin text-ink-muted" />
            ) : (
              <>
                <span
                  title={devices.mic ? "Mic ready" : "No mic"}
                  className={cn(
                    "inline-flex items-center gap-1",
                    devices.mic ? "text-ink" : "text-ink-muted/50",
                  )}
                >
                  <Mic className="h-3.5 w-3.5" />
                </span>
                <span
                  title={devices.cam ? "Camera ready" : "No camera"}
                  className={cn(
                    "inline-flex items-center gap-1",
                    devices.cam ? "text-ink" : "text-ink-muted/50",
                  )}
                >
                  <Video className="h-3.5 w-3.5" />
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* One-line subtitle */}
      <p className="mt-2 text-sm text-ink-muted">
        Drop into a live room, or open the first one. Voice or video · 5 seats per room.
      </p>

      {/* Live decision surface */}
      <div className="mt-4">
        <LiveTopicsList
          layout="split"
          busyKey={busy === "drop" ? busyMedium : null}
          onPick={handlePick}
          onLiveCountChange={setLiveCount}
          disabled={busy !== null}
        />
      </div>

      {devices && !canDrop && (
        <p className="mt-2 text-xs text-destructive">Connect a mic or camera to continue.</p>
      )}

      {/* Host strip — hairline, filled CTA */}
      <div className="mt-4 rounded-2xl border border-border/70 bg-surface px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <div className="hidden sm:grid h-9 w-9 place-items-center rounded-full bg-muted/40 text-ink shrink-0">
            <Crown className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink truncate">Want host controls?</div>
            <p className="text-xs text-ink-muted truncate">
              Name the room, pick visibility, share the link.
            </p>
          </div>
        </div>
        <Button
          onClick={handleHost}
          disabled={!canDrop || busy !== null}
          className="shrink-0 rounded-full h-9 gap-2 px-4"
        >
          {busy === "host" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
          {busy === "host" ? "Opening…" : hostLabel ? `Spin up ${hostLabel}` : "Spin up your room"}
        </Button>
      </div>

      <p className="mt-3 text-center text-[11px] text-ink-muted">
        Everything in a live room is ephemeral until someone creates a Collab from it.
      </p>

      <LiveWorkshopsRail
        canJoin={canDrop && busy === null}
        medium={null}
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
