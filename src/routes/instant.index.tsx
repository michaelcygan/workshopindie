import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Mic, Video, Loader2, ArrowLeft, Radio } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { joinLounge } from "@/lib/instant.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/instant/")({
  component: InstantPreflight,
  head: () => ({
    meta: [
      { title: "Instant — Drop into the Artist's Lounge" },
      { name: "description", content: "Drop into a live Artist's Lounge. Voice or video, up to 5 per room." },
    ],
  }),
});

function InstantPreflight() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const drop = useServerFn(joinLounge);
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<{ mic: boolean; cam: boolean } | null>(null);

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

  async function handleDrop() {
    if (busy || !canDrop || !devices) return;
    setBusy(true);
    try {
      // Pre-grant whichever the device has — request both when both exist so the
      // room page never needs a second permission prompt.
      const wantAudio = devices.mic;
      const wantVideo = devices.cam;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: wantAudio,
          video: wantVideo,
        });
        for (const t of stream.getTracks()) t.stop();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Permission denied";
        toast.error(`Couldn't access ${wantVideo && !wantAudio ? "camera" : "mic"}: ${msg}`);
        setBusy(false);
        return;
      }
      // Default mode: voice if mic available, else video-only.
      const mode = devices.mic ? "voice" : "video";
      const { roomId } = await drop();
      router.navigate({ to: "/instant/$id", params: { id: roomId }, search: { mode } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't drop in");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 md:px-6 md:py-20">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
        <h1 className="font-display text-4xl text-ink md:text-6xl flex items-center gap-3">
          Artist's Lounge
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
        </h1>
        <p className="mt-3 text-lg text-ink-muted">
          Drop into a live room with up to 5 artists. We'll find you a seat — there's always one open.
        </p>
      </motion.div>

      <div className="mt-10">
        <Button
          onClick={handleDrop}
          disabled={!canDrop || busy}
          size="lg"
          className="w-full rounded-2xl h-auto py-6 flex-col gap-2"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Radio className="h-6 w-6" />}
          <span className="text-base font-medium">{busy ? "Finding you a seat…" : "Drop in"}</span>
        </Button>

        <div className="mt-4 flex items-center justify-center gap-4 text-xs">
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
          <p className="mt-3 text-center text-xs text-destructive">
            Connect a mic or camera to drop in.
          </p>
        )}
        <p className="mt-3 text-center text-xs text-ink-muted">
          Rooms cap at 5 — when one fills, the next person opens a fresh one. You can switch between voice and video once inside.
        </p>
      </div>
    </main>
  );
}
