import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Circle,
  Download,
  Loader2,
  MonitorPlay,
  Mic,
  Square,
  Users,
} from "lucide-react";
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
import { RecorderEngine, type Layout, type RecordedFile, type SourceSpec } from "@/components/recorder/recorder-engine";

type RoomScope = { kind: "instant"; roomId: string } | { kind: "persistent"; workshopId: string };

type UIDevice = { deviceId: string; label: string };
type UIRow = {
  id: string;
  kind: SourceSpec["kind"];
  label: string;
  detail?: string;
  enabled: boolean;
  busy: boolean;
  error?: string;
  level: number; // 0..1 — sampled when live
  hasVideo: boolean;
  isLive: boolean;
};

const isSafari = typeof navigator !== "undefined" && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export function WorkshopRecorder({
  scope,
  media,
}: {
  scope: RoomScope;
  media?: ReturnType<typeof useMediaRoom>;
}) {
  const { user } = useAuth();
  const isInstant = scope.kind === "instant";
  const roomId = isInstant ? scope.roomId : null;

  // ---- Devices ----
  const [cams, setCams] = useState<UIDevice[]>([]);
  const [mics, setMics] = useState<UIDevice[]>([]);
  const [permissionAsked, setPermissionAsked] = useState(false);

  const askPermissionAndEnumerate = useCallback(async () => {
    if (permissionAsked) return;
    try {
      // Asking for both unlocks device labels on most browsers.
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }).catch(() => null);
      tmp?.getTracks().forEach((t) => t.stop());
    } catch { /* ignore */ }
    setPermissionAsked(true);
  }, [permissionAsked]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        setCams(list.filter((d) => d.kind === "videoinput").map((d) => ({ deviceId: d.deviceId, label: d.label || "Camera" })));
        setMics(list.filter((d) => d.kind === "audioinput").map((d) => ({ deviceId: d.deviceId, label: d.label || "Microphone" })));
      } catch { /* ignore */ }
    }
    void load();
    navigator.mediaDevices?.addEventListener?.("devicechange", load);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.("devicechange", load);
    };
  }, [permissionAsked]);

  // ---- Engine ----
  const engineRef = useRef<RecorderEngine | null>(null);
  if (!engineRef.current) engineRef.current = new RecorderEngine();
  const engine = engineRef.current;

  useEffect(() => () => engine.dispose(), [engine]);

  // ---- Sources state (UI rows) ----
  const peerRows: UIRow[] = useMemo(() => {
    const peers = media?.peers ?? [];
    return peers
      .filter((p) => !!p.stream)
      .map<UIRow>((p) => ({
        id: `remote:${p.userId}`,
        kind: "remote",
        label: "Participant",
        detail: p.userId.slice(0, 6),
        enabled: false,
        busy: false,
        level: 0,
        hasVideo: !!p.stream && p.stream.getVideoTracks().length > 0,
        isLive: false,
      }));
  }, [media?.peers]);

  // We track "enabled" + "isLive" + "level" per row in a single map keyed by row id.
  const [rowState, setRowState] = useState<Record<string, { enabled: boolean; isLive: boolean; busy: boolean; error?: string; level: number }>>({});

  const rows: UIRow[] = useMemo(() => {
    const all: UIRow[] = [];
    // Built-in: room camera + room mic (reuse live stream if media exists)
    if (media) {
      all.push({
        id: "self-cam",
        kind: "self-cam",
        label: "My room camera",
        detail: media.cameraOn ? "live" : "off",
        enabled: false, busy: false, level: 0, hasVideo: true, isLive: false,
      });
      all.push({
        id: "self-mic",
        kind: "self-mic",
        label: "My room mic",
        detail: media.muted ? "muted" : "live",
        enabled: false, busy: false, level: 0, hasVideo: false, isLive: false,
      });
    }
    for (const c of cams) all.push({
      id: `cam:${c.deviceId}`, kind: "camera", label: c.label, enabled: false, busy: false, level: 0, hasVideo: true, isLive: false,
    });
    for (const m of mics) all.push({
      id: `mic:${m.deviceId}`, kind: "mic", label: m.label, enabled: false, busy: false, level: 0, hasVideo: false, isLive: false,
    });
    all.push({
      id: "screen", kind: "screen", label: "Screen, window or tab", enabled: false, busy: false, level: 0, hasVideo: true, isLive: false,
    });
    for (const p of peerRows) all.push(p);
    // Merge in dynamic state
    return all.map((r) => {
      const s = rowState[r.id];
      return s ? { ...r, ...s } : r;
    });
  }, [cams, mics, peerRows, rowState, media]);

  // ---- Layout ----
  const [layout, setLayout] = useState<Layout>("grid");
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  useEffect(() => { engine.setLayout(layout, spotlightId); }, [engine, layout, spotlightId]);

  const enabledVideoSources = rows.filter((r) => r.enabled && r.hasVideo);
  const enabledAudioSources = rows.filter((r) => r.enabled && !r.hasVideo);
  const canRecord = (enabledVideoSources.length + enabledAudioSources.length) > 0;

  // ---- Toggle a source ----
  async function toggleRow(row: UIRow) {
    if (recording) return;
    if (!permissionAsked && (row.kind === "camera" || row.kind === "mic")) {
      await askPermissionAndEnumerate();
    }
    if (row.enabled) {
      engine.removeSource(row.id);
      setRowState((s) => ({ ...s, [row.id]: { enabled: false, isLive: false, busy: false, level: 0 } }));
      if (spotlightId === row.id) setSpotlightId(null);
      return;
    }
    setRowState((s) => ({ ...s, [row.id]: { enabled: true, isLive: false, busy: true, level: 0 } }));
    try {
      let spec: SourceSpec;
      let provided: MediaStream | undefined;
      if (row.kind === "self-cam") {
        if (!media?.localStream || media.localStream.getVideoTracks().length === 0) {
          throw new Error("Turn your room camera on first.");
        }
        spec = { id: row.id, kind: "self-cam", label: "My camera" };
        provided = new MediaStream(media.localStream.getVideoTracks());
      } else if (row.kind === "self-mic") {
        if (!media?.localStream || media.localStream.getAudioTracks().length === 0) {
          throw new Error("Join the room with audio first.");
        }
        spec = { id: row.id, kind: "self-mic", label: "My mic" };
        provided = new MediaStream(media.localStream.getAudioTracks());
      } else if (row.kind === "remote") {
        const userId = row.id.slice("remote:".length);
        const peer = media?.peers.find((p) => p.userId === userId);
        if (!peer?.stream) throw new Error("Participant left.");
        spec = { id: row.id, kind: "remote", label: `Participant ${userId.slice(0, 6)}`, peerUserId: userId };
        provided = peer.stream;
      } else if (row.kind === "camera") {
        spec = { id: row.id, kind: "camera", label: row.label, deviceId: row.id.slice("cam:".length) };
      } else if (row.kind === "mic") {
        spec = { id: row.id, kind: "mic", label: row.label, deviceId: row.id.slice("mic:".length) };
      } else if (row.kind === "screen") {
        spec = { id: row.id, kind: "screen", label: "Screen" };
        engine.onSourceEnded = (id) => {
          if (id !== "screen") return;
          engine.removeSource(id);
          setRowState((s) => ({ ...s, [id]: { enabled: false, isLive: false, busy: false, level: 0 } }));
        };
      } else {
        throw new Error("Unknown source");
      }
      await engine.addSource(spec, provided);
      setRowState((s) => ({ ...s, [row.id]: { enabled: true, isLive: true, busy: false, level: 0 } }));
      if (row.hasVideo && !spotlightId) setSpotlightId(row.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't add source";
      setRowState((s) => ({ ...s, [row.id]: { enabled: false, isLive: false, busy: false, level: 0, error: msg } }));
      toast.error(msg);
    }
  }

  // ---- VU meter polling ----
  useEffect(() => {
    let raf = 0;
    function tick() {
      const live = engine.listSources();
      if (live.length > 0) {
        setRowState((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const ls of live) {
            const cur = prev[ls.id];
            const lvl = ls.level();
            if (!cur || Math.abs(cur.level - lvl) > 0.02) {
              changed = true;
              next[ls.id] = { ...(cur ?? { enabled: true, isLive: true, busy: false, level: 0 }), level: lvl };
            }
          }
          return changed ? next : prev;
        });
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  // ---- Recording state ----
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<Array<{ name: string; url: string; mime: string; bytes: number; isMixed: boolean }>>([]);
  const elapsedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!recording) {
      if (elapsedTimerRef.current) { window.clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
      return;
    }
    elapsedTimerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { if (elapsedTimerRef.current) { window.clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; } };
  }, [recording]);

  // ---- Consent broadcast (instant rooms only) ----
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [activeRecording, setActiveRecording] = useState<{ by: string; name: string } | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  useEffect(() => {
    if (!roomId || !user) return;
    const ch = supabase.channel(`recorder:${roomId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "recorder" }, ({ payload }) => {
      const ev = payload as { type: "start"; by: string; name: string } | { type: "stop" };
      if (ev.type === "start") { setActiveRecording({ by: ev.by, name: ev.name }); setConsentOpen(true); }
      else { setActiveRecording(null); setConsentOpen(false); }
    }).subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); channelRef.current = null; };
  }, [roomId, user]);

  function broadcast(payload: unknown) { channelRef.current?.send({ type: "broadcast", event: "recorder", payload }); }

  function muteSelfForRecording() {
    if (!media) { setConsentOpen(false); return; }
    if (!media.muted) media.toggleMute();
    if (media.cameraOn) media.setCameraEnabled(false);
    setConsentOpen(false);
  }

  // ---- Start / stop ----
  async function start() {
    if (!user) return;
    if (!canRecord) { toast.error("Pick at least one source."); return; }
    setElapsed(0);
    setResults([]);
    try {
      await engine.start();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start");
      return;
    }
    setRecording(true);
    if (isInstant && user) {
      broadcast({ type: "start", by: user.id, name: user.user_metadata?.display_name ?? user.email ?? "Someone" });
    }
  }

  async function stop() {
    setRecording(false);
    setUploading(true);
    let files: RecordedFile[] = [];
    try {
      files = await engine.stop();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stop failed");
    }
    if (isInstant && user) broadcast({ type: "stop" });

    if (files.length === 0) { setUploading(false); return; }

    const takeId = crypto.randomUUID();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const out: typeof results = [];

    if (isInstant && roomId && user) {
      for (const f of files) {
        const base = f.sourceId === "mixed" ? "mixed" : slugify(f.label);
        const ext = f.mime.startsWith("audio/") ? "webm" : "webm";
        const filename = `${base}-${stamp}.${ext}`;
        const path = `${roomId}/${user.id}/takes/${takeId}/${filename}`;
        try {
          const { error: upErr } = await supabase.storage.from("instant-drive").upload(path, f.blob, { contentType: f.mime, upsert: false });
          if (upErr) throw upErr;
          const { error: rowErr } = await (supabase.from("instant_drive_files") as any).insert({
            room_id: roomId,
            uploader_id: user.id,
            storage_path: path,
            filename,
            mime_type: f.mime,
            byte_size: f.blob.size,
            duration_ms: f.durationMs,
            note: f.sourceId === "mixed" ? "Mixed take" : `Raw: ${f.label}`,
            take_id: takeId,
          });
          if (rowErr) throw rowErr;
          const { data: signed } = await supabase.storage.from("instant-drive").createSignedUrl(path, 60 * 60);
          out.push({ name: filename, url: signed?.signedUrl ?? URL.createObjectURL(f.blob), mime: f.mime, bytes: f.blob.size, isMixed: f.sourceId === "mixed" });
        } catch (e) {
          toast.error(`${filename}: ${e instanceof Error ? e.message : "upload failed"}`);
          out.push({ name: filename, url: URL.createObjectURL(f.blob), mime: f.mime, bytes: f.blob.size, isMixed: f.sourceId === "mixed" });
        }
      }
      toast.success(`Take saved · ${files.length} file${files.length === 1 ? "" : "s"}`);
    } else {
      // Persistent rooms: local download fallback (Drive wiring lives next door).
      for (const f of files) {
        const filename = `${f.sourceId === "mixed" ? "mixed" : slugify(f.label)}-${stamp}.webm`;
        out.push({ name: filename, url: URL.createObjectURL(f.blob), mime: f.mime, bytes: f.blob.size, isMixed: f.sourceId === "mixed" });
      }
      toast.message("Recording ready — download below.");
    }
    setResults(out);
    setUploading(false);

    // Drop the now-stopped per-source state but keep selections so the user can record again immediately.
  }

  // ---- UI ----
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Recorder · Studio</div>
            <div className="mt-0.5 font-display text-lg leading-tight text-ink">Capture a take</div>
          </div>
          {recording ? (
            <div className="flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-70" />
                <span className="relative h-2 w-2 rounded-full bg-destructive" />
              </span>
              <span className="font-mono text-xs tabular-nums text-destructive">REC {mins(elapsed)}</span>
            </div>
          ) : uploading ? (
            <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-ink-soft">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </div>
          ) : null}
        </div>

        {/* Sources */}
        <div className="divide-y divide-border/40">
          <Section title="Sources" hint="Pick anything you want in the take. Each one becomes its own raw file plus part of the mixed video.">
            <div className="space-y-1">
              <GroupLabel icon={<Camera className="h-3 w-3" />} label="Cameras" />
              {rows.filter((r) => r.kind === "self-cam" || r.kind === "camera").map((r) => (
                <SourceRow key={r.id} row={r} disabled={recording} onToggle={() => toggleRow(r)} />
              ))}
              {cams.length === 0 && !rows.some(r => r.kind === "self-cam") && (
                <button onClick={askPermissionAndEnumerate} className="text-xs text-ink-muted underline underline-offset-2">Grant access to list cameras</button>
              )}
            </div>
            <div className="space-y-1 pt-2">
              <GroupLabel icon={<Mic className="h-3 w-3" />} label="Microphones & line inputs" />
              {rows.filter((r) => r.kind === "self-mic" || r.kind === "mic").map((r) => (
                <SourceRow key={r.id} row={r} disabled={recording} onToggle={() => toggleRow(r)} />
              ))}
              {mics.length === 0 && (
                <button onClick={askPermissionAndEnumerate} className="text-xs text-ink-muted underline underline-offset-2">Grant access to list audio inputs (USB-C, interfaces, MIDI synths)</button>
              )}
            </div>
            <div className="space-y-1 pt-2">
              <GroupLabel icon={<MonitorPlay className="h-3 w-3" />} label="Screen" />
              {rows.filter((r) => r.kind === "screen").map((r) => (
                <SourceRow key={r.id} row={r} disabled={recording} onToggle={() => toggleRow(r)} />
              ))}
            </div>
            {peerRows.length > 0 && (
              <div className="space-y-1 pt-2">
                <GroupLabel icon={<Users className="h-3 w-3" />} label="Participants" />
                {rows.filter((r) => r.kind === "remote").map((r) => (
                  <SourceRow key={r.id} row={r} disabled={recording} onToggle={() => toggleRow(r)} />
                ))}
              </div>
            )}
          </Section>

          {/* Layout */}
          {enabledVideoSources.length > 1 && (
            <Section title="Layout" hint="How to compose multiple video sources in the mixed file.">
              <div className="flex flex-wrap gap-2">
                {(["grid", "spotlight", "single"] as Layout[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLayout(l)}
                    disabled={recording}
                    className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                      layout === l ? "border-ink bg-ink text-bg" : "border-border bg-surface text-ink hover:bg-muted"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {(layout === "spotlight" || layout === "single") && (
                <div className="mt-3">
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted mb-1">{layout === "single" ? "Show only" : "Spotlight"}</div>
                  <div className="flex flex-wrap gap-2">
                    {enabledVideoSources.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setSpotlightId(r.id)}
                        disabled={recording}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          spotlightId === r.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-ink-soft hover:bg-muted"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Output / record */}
          <Section title="Output" hint={isInstant ? "Saves to Drive. Mixed file is for sharing; raw files are for editing." : "Currently downloads locally on persistent rooms."}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-ink-soft">
                {canRecord ? (
                  <>
                    <span className="font-mono">{enabledVideoSources.length + enabledAudioSources.length}</span> source{enabledVideoSources.length + enabledAudioSources.length === 1 ? "" : "s"} ·
                    {" "}
                    {enabledVideoSources.length > 0 ? "1 mixed + " : ""}{enabledVideoSources.length + enabledAudioSources.length} raw file{enabledVideoSources.length + enabledAudioSources.length === 1 ? "" : "s"}
                  </>
                ) : (
                  <span className="text-ink-muted">No sources selected.</span>
                )}
              </div>
              {recording ? (
                <Button onClick={stop} variant="outline" size="sm" className="rounded-full gap-1.5">
                  <Square className="h-3.5 w-3.5" /> Stop
                </Button>
              ) : (
                <Button onClick={start} disabled={!canRecord || uploading || !!activeRecording} className="rounded-full gap-2">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  Start recording
                </Button>
              )}
            </div>
            {activeRecording && !recording && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-ink-soft">
                <AlertCircle className="h-3 w-3" /> {activeRecording.name} is recording the room
              </div>
            )}
            {isSafari && (
              <p className="mt-2 text-[11px] text-ink-muted">Safari may produce split tracks only; mixed file works best in Chrome / Edge / Firefox.</p>
            )}
          </Section>

          {/* Results */}
          {results.length > 0 && (
            <Section title="Take" hint="Click to preview, or download.">
              <ul className="space-y-2">
                {results.map((r) => (
                  <li key={r.name} className="rounded-xl border border-border bg-surface-2 p-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={`h-4 w-4 ${r.isMixed ? "text-primary" : "text-ink-muted"}`} />
                      <span className="truncate text-sm text-ink">{r.name}</span>
                      <span className="ml-auto text-[11px] tabular-nums text-ink-muted">{prettyBytes(r.bytes)}</span>
                      <a href={r.url} download={r.name} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-ink hover:bg-muted">
                        <Download className="h-3 w-3" /> Save
                      </a>
                    </div>
                    {r.mime.startsWith("video/") ? (
                      <video src={r.url} controls className="mt-2 w-full rounded-lg bg-black" />
                    ) : (
                      <audio src={r.url} controls className="mt-2 w-full" />
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
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
              If you'd rather not be captured, mute your mic and camera — the recording keeps going without you.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={muteSelfForRecording} className="rounded-full">Mute me</Button>
            <Button onClick={() => setConsentOpen(false)} className="rounded-full">I'm in</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- bits --------------------------------------------------------------

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">{title}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-muted">{hint}</div>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function GroupLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-muted">
      {icon} {label}
    </div>
  );
}

function SourceRow({ row, disabled, onToggle }: { row: UIRow; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled || row.busy}
      className={`group flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition ${
        row.enabled
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-surface hover:bg-muted"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <span className={`flex h-4 w-4 items-center justify-center rounded border ${row.enabled ? "border-primary bg-primary text-bg" : "border-border text-transparent"}`}>
        {row.enabled && <Circle className="h-2 w-2 fill-current" />}
      </span>
      <span className="flex-1 truncate text-sm text-ink">{row.label}</span>
      {row.detail && <span className="text-[10px] uppercase tracking-wider text-ink-muted">{row.detail}</span>}
      {row.isLive && !row.hasVideo && <VuMeter level={row.level} />}
      {row.busy && <Loader2 className="h-3 w-3 animate-spin text-ink-muted" />}
    </button>
  );
}

function VuMeter({ level }: { level: number }) {
  const pct = Math.min(100, Math.round(level * 140));
  return (
    <span className="ml-2 flex h-1 w-16 overflow-hidden rounded-full bg-muted">
      <span
        className={`h-full transition-all ${pct > 90 ? "bg-destructive" : pct > 60 ? "bg-amber-500" : "bg-primary"}`}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "src";
}
function mins(s: number) { const m = Math.floor(s / 60); const r = s % 60; return `${m}:${String(r).padStart(2, "0")}`; }
function prettyBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
