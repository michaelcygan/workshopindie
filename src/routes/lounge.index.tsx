import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, Loader2, ArrowLeft, RadioTower, X, Sparkles, Activity } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { joinLounge, joinMediumLounge, hostInstantWorkshop } from "@/lib/instant.functions";
import { LiveTopicsList } from "@/components/live-topics-list";
import { RoomPromptMarquee } from "@/components/room-prompt-marquee";
import { LiveWorkshopsRail } from "@/components/live-workshops-rail";
// HostPrivacyDialog retired — v1 Lounges are always public/open, no host privacy step.
import { CATEGORIES, type Category } from "@/lib/categories";
import type { RoomPrompt } from "@/lib/topic-prompts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/lounge/")({
  component: () => <RequireAuth><WorkshopPreflight /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "Lounge — Drop in or host" },
      { name: "description", content: "Drop into the Lounge or open a new room. Voice or video, up to 5 per room." },
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
  const [prefs, setPrefs] = useState<{ mic: boolean; cam: boolean }>(() => {
    if (typeof window === "undefined") return { mic: true, cam: true };
    try {
      const raw = window.localStorage.getItem("workshop:av-prefs");
      if (raw) return JSON.parse(raw);
    } catch { /* noop */ }
    return { mic: true, cam: true };
  });
  const [liveCount, setLiveCount] = useState(0);
  const [liveByMedium, setLiveByMedium] = useState<Map<Category, number>>(new Map());
  const [hostMedium] = useState<Category | null>(null);
  const [firstVisit, setFirstVisit] = useState(false);
  const [rejoin, setRejoin] = useState<{ id: string; title: string; leftAt: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [idleNudge, setIdleNudge] = useState(false);
  const hostLabel = hostMedium ? CATEGORIES.find((c) => c.id === hostMedium)?.label ?? null : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem("workshop:opened-once");
    if (!seen) {
      setFirstVisit(true);
      window.localStorage.setItem("workshop:opened-once", "1");
    }
    try {
      const raw = window.sessionStorage.getItem("workshop:last-room");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { id: string; title: string; leftAt: number };
      if (Date.now() - parsed.leftAt < 60_000) {
        setRejoin({ id: parsed.id, title: parsed.title, leftAt: parsed.leftAt });
        const ms = 60_000 - (Date.now() - parsed.leftAt);
        const t = setTimeout(() => {
          setRejoin(null);
          window.sessionStorage.removeItem("workshop:last-room");
        }, ms);
        return () => clearTimeout(t);
      }
      window.sessionStorage.removeItem("workshop:last-room");
    } catch {
      // ignore
    }
  }, []);

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

  // Tick once a second only while the rejoin pill is showing — drives the countdown ring.
  useEffect(() => {
    if (!rejoin) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [rejoin]);

  // Idle nudge: if all mediums are empty for >20s, surface "be first" hint.
  useEffect(() => {
    setIdleNudge(false);
    if (liveCount > 0) return;
    const t = setTimeout(() => setIdleNudge(true), 20_000);
    return () => clearTimeout(t);
  }, [liveCount]);

  // 24h recap chip — counts activity events in the last day.
  const { data: recap24h = 0 } = useQuery({
    queryKey: ["workshop-recap-24h"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("instant_activity")
        .select("id", { count: "exact", head: true })
        .gt("created_at", cutoff);
      return count ?? 0;
    },
  });

  const favoriteMedium: Category | null = useMemo(() => {
    let best: Category | null = null;
    let bestN = -1;
    liveByMedium.forEach((n, m) => { if (n > bestN) { bestN = n; best = m; } });
    return best ?? "writing";
  }, [liveByMedium]);

  const effMic = !!devices?.mic && prefs.mic;
  const effCam = !!devices?.cam && prefs.cam;
  const canDrop = effMic || effCam;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem("workshop:av-prefs", JSON.stringify(prefs)); } catch { /* noop */ }
  }, [prefs]);

  const toggleMic = () => {
    if (!devices?.mic) { toast.error("No microphone detected."); return; }
    setPrefs((p) => ({ ...p, mic: !p.mic }));
  };
  const toggleCam = () => {
    if (!devices?.cam) { toast.error("No camera detected."); return; }
    setPrefs((p) => ({ ...p, cam: !p.cam }));
  };

  const preGrantMedia = useCallback(async (): Promise<"video" | "voice" | null> => {
    if (!devices) return null;
    if (!effMic && !effCam) return null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: effMic,
        video: effCam,
      });
      for (const t of stream.getTracks()) t.stop();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Permission denied";
      toast.error(`Couldn't access ${effCam && !effMic ? "camera" : "mic"}: ${msg}`);
      return null;
    }
    return effCam ? "video" : "voice";
  }, [devices, effMic, effCam]);

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
      if (medium == null && liveCount === 0) {
        toast("Opening a fresh Lounge — others can drop in any second.");
      }
      const { roomId } = medium
        ? await dropMedium({ data: { medium } })
        : await drop({ data: {} });
      router.navigate({ to: "/lounge/$id", params: { id: roomId }, search: { mode } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open that room");
      setBusy(null);
      setBusyMedium(null);
    }
  }

  async function openLounge(medium: Category | null, title: string | null) {
    if (busy || !canDrop) {
      if (!canDrop) toast.error("Connect a mic or camera to continue.");
      return;
    }
    setBusy("host");
    try {
      const mode = await preGrantMedia();
      if (!mode) { setBusy(null); return; }
      const { roomId } = await host({
        data: {
          medium: medium ?? null,
          title: title || null,
          visibility: "open",
        },
      });
      qc.invalidateQueries({ queryKey: ["instant-active-rooms"] });
      router.invalidate();
      router.navigate({ to: "/lounge/$id", params: { id: roomId }, search: { mode } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open your Lounge");
      setBusy(null);
    }
  }

  const [hostTitle, setHostTitle] = useState("");

  function handleHost() {
    openLounge(hostMedium, hostTitle.trim() || null);
  }


  function handleUsePrompt(p: RoomPrompt) {
    openLounge(p.medium, p.title);
  }


  const subtitle =
    liveCount === 0
      ? "No one's in yet. Open the first room — it fills fast."
      : liveCount === 1
      ? "One room is open. Take a seat or start your own."
      : `${liveCount} rooms going. Drop in or host your own.`;

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
          <h1 className="font-display text-2xl md:text-[28px] leading-none text-ink truncate">
            Lounge
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Live count chip — mobile only; desktop shows the count inside the topic column */}
          <div className="md:hidden inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
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

          <span className="md:hidden h-4 w-px bg-border/70" aria-hidden />

          <div className="inline-flex items-center gap-2 text-xs">
            {devices === null ? (
              <Loader2 className="h-3 w-3 animate-spin text-ink-muted" />
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={!devices.mic}
                  title={!devices.mic ? "No mic detected" : effMic ? "Mic on — click to mute on join" : "Mic muted — click to unmute"}
                  aria-label={!devices.mic ? "No microphone detected" : effMic ? "Mute microphone" : "Unmute microphone"}
                  aria-pressed={effMic}
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-md border transition",
                    !devices.mic
                      ? "border-transparent text-ink-muted/40 cursor-not-allowed"
                      : effMic
                        ? "border-ink/15 bg-ink/5 text-ink hover:bg-ink/10"
                        : "border-border text-ink-muted hover:text-ink hover:bg-muted/50",
                  )}
                >
                  {effMic ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={toggleCam}
                  disabled={!devices.cam}
                  title={!devices.cam ? "No camera detected" : effCam ? "Camera on — click to turn off on join" : "Camera off — click to turn on"}
                  aria-label={!devices.cam ? "No camera detected" : effCam ? "Turn camera off" : "Turn camera on"}
                  aria-pressed={effCam}
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-md border transition",
                    !devices.cam
                      ? "border-transparent text-ink-muted/40 cursor-not-allowed"
                      : effCam
                        ? "border-ink/15 bg-ink/5 text-ink hover:bg-ink/10"
                        : "border-border text-ink-muted hover:text-ink hover:bg-muted/50",
                  )}
                >
                  {effCam ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
                </button>

              </>
            )}
          </div>
        </div>
      </header>

      {/* One-line subtitle — adapts to live state */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-sm text-ink-muted">
          {subtitle} <span className="text-ink-muted/70">· Voice or video · 5 seats per room.</span>
        </p>
        {recap24h > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-ink-soft">
            <Activity className="h-2.5 w-2.5" />
            {recap24h} in the last 24h
          </span>
        )}
      </div>
      {firstVisit && liveCount === 0 && (
        <p className="mt-1 text-xs text-ink/70 italic">You're the spark right now.</p>
      )}

      <AnimatePresence>
        {rejoin && (() => {
          const elapsed = Math.min(60_000, now - rejoin.leftAt);
          const remaining = Math.max(0, 60 - Math.floor(elapsed / 1000));
          const pct = Math.min(100, (elapsed / 60_000) * 100);
          return (
            <motion.div
              key="rejoin"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-3 flex"
            >
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface pl-1 pr-1 py-1 text-xs text-ink shadow-soft">
                <Link
                  to="/lounge/$id"
                  params={{ id: rejoin.id }}
                  search={{ mode: "video" }}
                  className="inline-flex items-center gap-2 rounded-full pl-1 pr-2 py-0.5 hover:bg-muted/40 transition"
                >
                  <span
                    className="grid h-5 w-5 place-items-center rounded-full"
                    style={{ background: `conic-gradient(var(--primary) ${pct}%, var(--muted) 0)` }}
                  >
                    <span className="h-3 w-3 rounded-full bg-surface grid place-items-center">
                      <span className="gradient-motion h-1.5 w-1.5 rounded-full" />
                    </span>
                  </span>
                  <span>Rejoin {rejoin.title || "your room"}</span>
                  <span className="tabular-nums text-ink-muted/80">{remaining}s</span>
                </Link>
                <button
                  type="button"
                  aria-label="Dismiss rejoin"
                  onClick={() => {
                    setRejoin(null);
                    try { window.sessionStorage.removeItem("workshop:last-room"); } catch { /* ignore */ }
                  }}
                  className="grid h-5 w-5 place-items-center rounded-full text-ink-muted hover:text-ink hover:bg-muted/40 transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {idleNudge && liveCount === 0 && devices && canDrop && (
        <div className="mt-3 flex items-center gap-2 rounded-full bg-primary/5 border border-primary/15 px-3 py-1.5 text-xs text-ink-soft">
          <Sparkles className="h-3 w-3 text-primary shrink-0" />
          <span>Be first — start a {CATEGORIES.find((c) => c.id === favoriteMedium)?.label ?? "Writing"} Lounge.</span>
          <button
            type="button"
            onClick={() => openLounge(favoriteMedium, null)}
            className="ml-auto font-medium text-primary hover:underline"
          >
            Open
          </button>
        </div>
      )}


      {/* Live decision surface — stack on mobile, split on desktop.
          Both mount the same LiveTopicsList; its internal useQuery(["instant-active-rooms"])
          dedupes across instances, so no extra fetch. */}
      <div className="mt-4 md:hidden">
        <LiveWorkshopsRail
          variant="compact-pills"
          canJoin={canDrop && busy === null}
          medium={null}
          onTakeSeat={async (roomId) => {
            const mode = await preGrantMedia();
            router.navigate({ to: "/lounge/$id", params: { id: roomId }, search: { mode: mode ?? "video" } });
          }}
        />
        <div className="mt-3">
          <LiveTopicsList
            layout="stack"
            busyKey={busy === "drop" ? busyMedium : null}
            onPick={handlePick}
            onPickFlavor={handleUsePrompt}
            onLiveCountChange={setLiveCount}
            onLiveByMediumChange={setLiveByMedium}
            disabled={busy !== null}
            featuredFooter={
              <RoomPromptMarquee
                variant="static-row"
                onUsePrompt={handleUsePrompt}
                onJoinLive={(m) => handlePick(m)}
                liveByMedium={liveByMedium}
                disabled={busy !== null || !canDrop}
              />
            }
          />
        </div>
      </div>

      <div className="mt-4 hidden md:block">
        <LiveTopicsList
          layout="split"
          busyKey={busy === "drop" ? busyMedium : null}
          onPick={handlePick}
          onPickFlavor={handleUsePrompt}
          disabled={busy !== null}
          featuredFooter={
            <RoomPromptMarquee
              onUsePrompt={handleUsePrompt}
              onJoinLive={(m) => handlePick(m)}
              liveByMedium={liveByMedium}
              disabled={busy !== null || !canDrop}
            />
          }
        />
      </div>


      {devices && !canDrop && (
        <div className="mt-3 rounded-2xl border border-border/70 bg-surface px-4 py-3 flex items-center gap-3">
          <div className="hidden sm:grid h-9 w-9 place-items-center rounded-full bg-muted/40 text-ink shrink-0">
            <Mic className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink">No mic or camera detected.</div>
            <p className="text-xs text-ink-muted">
              Lounge rooms are voice or video — connect a device, or open this page on your phone.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full shrink-0"
            onClick={async () => { await preGrantMedia(); }}
          >
            Test setup
          </Button>
        </div>
      )}

      {/* Host strip — hairline, filled CTA */}
      <div className="mt-4 rounded-2xl border border-border/70 bg-surface px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <div className="hidden sm:grid h-9 w-9 place-items-center rounded-full bg-muted/40 text-ink shrink-0">
            <RadioTower className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink truncate">Hosting a Lounge?</div>
            <p className="text-xs text-ink-muted truncate">
              Optional: name it so it stays yours to rename or end.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:shrink-0 w-full sm:w-auto">
          <input
            type="text"
            value={hostTitle}
            onChange={(e) => setHostTitle(e.target.value.slice(0, 80))}
            placeholder="Name this Lounge (optional)"
            maxLength={80}
            className="h-11 sm:h-9 min-w-0 w-full sm:w-56 rounded-full border border-border bg-background px-3 text-sm text-ink placeholder:text-ink-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <Button
            onClick={handleHost}
            disabled={!canDrop || busy !== null}
            className="shrink-0 rounded-full h-11 sm:h-9 gap-2 px-4 w-full sm:w-auto justify-center"
          >
            {busy === "host" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RadioTower className="h-4 w-4" />}
            {busy === "host" ? "Opening…" : hostLabel ? `Open a ${hostLabel} Lounge` : "Open the Lounge"}
          </Button>
        </div>
      </div>


      <p className="mt-3 text-center text-[11px] text-ink-muted">
        Lounges are ephemeral and deleted at close — start a{" "}
        <Link to="/collab/new" className="underline decoration-ink-muted/40 hover:text-ink hover:decoration-ink/60 transition">
          Collab
        </Link>
        {" "}to keep the work.
      </p>

      <LiveWorkshopsRail
        canJoin={canDrop && busy === null}
        medium={null}
        onTakeSeat={async (roomId) => {
          const mode = await preGrantMedia();
          router.navigate({ to: "/lounge/$id", params: { id: roomId }, search: { mode: mode ?? "video" } });
        }}
      />
    </main>
  );
}
