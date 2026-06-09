import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { useMediaRoom } from "@/hooks/use-media-room";

type RoomScope = { kind: "instant"; roomId: string } | { kind: "persistent"; workshopId: string };

/**
 * Recorder tool — captures screen + audio via getDisplayMedia, uploads the
 * resulting .webm to the `instant-drive` bucket and writes a row in
 * `instant_drive_files`.
 *
 * Other room members see a consent dialog when someone starts a recording.
 * If they decline they can flip their mic/cam off; the recording continues.
 *
 * For v1 the recorder runs locally in the initiator's browser, so they pick
 * what to capture (a tab, a window, the gallery view, the screen-share view).
 */
export function WorkshopRecorder({
  scope,
  media,
}: {
  scope: RoomScope;
  media?: ReturnType<typeof useMediaRoom>;
}) {
  const { user } = useAuth();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeRecording, setActiveRecording] = useState<{ by: string; name: string; startedAt: number } | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastRecording, setLastRecording] = useState<{ name: string; url: string } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<number | null>(null);
  const isInstant = scope.kind === "instant";
  const roomId = isInstant ? scope.roomId : null;

  // Subscribe to a per-room channel for consent broadcasts.
  useEffect(() => {
    if (!roomId || !user) return;
    const ch = supabase.channel(`recorder:${roomId}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "recorder" }, ({ payload }) => {
      const ev = payload as
        | { type: "start"; by: string; name: string; startedAt: number }
        | { type: "stop"; by: string };
      if (ev.type === "start") {
        setActiveRecording({ by: ev.by, name: ev.name, startedAt: ev.startedAt });
        setConsentOpen(true);
      } else if (ev.type === "stop") {
        setActiveRecording(null);
        setConsentOpen(false);
      }
    }).subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [roomId, user]);

  useEffect(() => {
    if (!recording) {
      if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [recording]);

  function broadcast(payload: unknown) {
    channelRef.current?.send({ type: "broadcast", event: "recorder", payload });
  }

  async function start() {
    if (!user) return;
    setElapsed(0);
    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 24 } },
        audio: true,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't start recording";
      if (!/denied|cancel/i.test(msg)) toast.error(msg);
      return;
    }

    // Mix the recorder's local mic in so their voice is captured even if
    // the picked source has no audio.
    let mixed: MediaStream = display;
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const AudioCtx: typeof AudioContext =
        (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const ctx = new AudioCtx();
      const dest = ctx.createMediaStreamDestination();
      for (const src of [display, mic]) {
        if (src.getAudioTracks().length > 0) {
          const node = ctx.createMediaStreamSource(src);
          node.connect(dest);
        }
      }
      mixed = new MediaStream([
        ...display.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);
      // Keep mic tracks alive so they're captured.
      (mixed as MediaStream & { _mic?: MediaStream })._mic = mic;
    } catch {
      // Mic optional — keep display-only stream.
    }

    streamRef.current = mixed;
    chunksRef.current = [];
    const mime =
      MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus"
      : "video/webm";
    const rec = new MediaRecorder(mixed, { mimeType: mime });
    rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
    rec.onstop = onStop;
    recorderRef.current = rec;
    rec.start(1000);

    // Auto-stop if the user clicks "Stop sharing" in the browser picker UI.
    display.getVideoTracks()[0].addEventListener("ended", () => { stop(); });

    setRecording(true);
    if (isInstant && user) {
      broadcast({
        type: "start",
        by: user.id,
        name: user.user_metadata?.display_name ?? user.email ?? "Someone",
        startedAt: Date.now(),
      });
    }
  }

  function stop() {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setRecording(false);
    if (isInstant && user) broadcast({ type: "stop", by: user.id });
  }

  async function onStop() {
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    chunksRef.current = [];
    const stream = streamRef.current;
    if (stream) {
      for (const t of stream.getTracks()) t.stop();
      const mic = (stream as MediaStream & { _mic?: MediaStream })._mic;
      if (mic) for (const t of mic.getTracks()) t.stop();
    }
    streamRef.current = null;

    if (!user) return;
    if (!isInstant) {
      // Persistent scope: not yet wired up. Offer local download instead.
      const url = URL.createObjectURL(blob);
      setLastRecording({ name: `recording-${new Date().toISOString()}.webm`, url });
      toast.message("Recording saved locally — Drive upload ships with persistent rooms next.");
      return;
    }

    setUploading(true);
    try {
      const filename = `recording-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
      const path = `${roomId}/${user.id}/${filename}`;
      const { error: upErr } = await supabase.storage
        .from("instant-drive")
        .upload(path, blob, { contentType: "video/webm", upsert: false });
      if (upErr) throw upErr;

      const { error: rowErr } = await supabase.from("instant_drive_files").insert({
        room_id: roomId!,
        uploader_id: user.id,
        storage_path: path,
        filename,
        mime_type: "video/webm",
        byte_size: blob.size,
        duration_ms: elapsed * 1000,
        note: "Room recording",
      });
      if (rowErr) throw rowErr;

      const { data: signed } = await supabase.storage
        .from("instant-drive")
        .createSignedUrl(path, 60 * 60);
      setLastRecording({ name: filename, url: signed?.signedUrl ?? "" });
      toast.success("Recording saved to Drive.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
      // Fall back to local download.
      const url = URL.createObjectURL(blob);
      setLastRecording({ name: `recording.webm`, url });
    } finally {
      setUploading(false);
    }
  }

  function mins(s: number) {
    const m = Math.floor(s / 60); const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function muteSelfForRecording(mute: boolean) {
    if (!media) { setConsentOpen(false); return; }
    if (mute) {
      if (!media.muted) media.toggleMute();
      if (media.cameraOn) media.setCameraEnabled(false);
    }
    setConsentOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mic className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg text-ink">Recorder</h3>
            <p className="text-sm text-ink-muted">
              Capture a take. Pick a window or tab to record — the gallery for speakers, the screen-share view for the presenter,
              or a specific window for just one camera. Your mic gets mixed in.
            </p>
          </div>
        </div>

        {recording ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-destructive/5 px-3 py-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-60" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-destructive" />
            </span>
            <span className="text-sm font-medium text-destructive">Recording</span>
            <span className="ml-2 font-mono text-sm tabular-nums text-ink">{mins(elapsed)}</span>
            <Button onClick={stop} variant="outline" size="sm" className="ml-auto rounded-full gap-1.5">
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          </div>
        ) : uploading ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-ink-soft">
            <Loader2 className="h-4 w-4 animate-spin" /> Saving to Drive…
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={start} className="rounded-full gap-2" disabled={!!activeRecording}>
              <span className="h-2 w-2 rounded-full bg-destructive" />
              Start recording
            </Button>
            {activeRecording && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-ink-soft">
                <AlertCircle className="h-3 w-3" /> {activeRecording.name} is recording
              </span>
            )}
          </div>
        )}

        {lastRecording && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="truncate text-sm text-ink">{lastRecording.name}</span>
            {lastRecording.url && (
              <a href={lastRecording.url} download={lastRecording.name} className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <Download className="h-3 w-3" /> Download
              </a>
            )}
          </div>
        )}

        <p className="mt-3 text-[11px] text-ink-muted">
          Recordings save to <span className="font-medium text-ink-soft">Drive</span>. Browser support: Chrome, Edge, Firefox desktop. (Not available on Safari iOS.)
        </p>
      </div>

      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-60" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-destructive" />
              </span>
              {activeRecording?.name ?? "Someone"} started a recording
            </DialogTitle>
            <DialogDescription>
              You can stay in the room either way. If you'd rather not be captured, turn your mic & camera off — the
              recording will keep going without you.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => muteSelfForRecording(true)} className="rounded-full">
              Mute me
            </Button>
            <Button onClick={() => setConsentOpen(false)} className="rounded-full">
              I'm in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
