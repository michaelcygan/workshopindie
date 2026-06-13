/**
 * Recorder engine — pure browser-side capture, mix and split-track recording.
 *
 * `SourceSpec` describes one input the user has ticked. The engine opens it
 * (camera, mic/line-in, screen, remote peer stream), runs a per-source
 * `MediaRecorder` for the raw "split" file, and feeds every source into the
 * shared canvas/audio graph for the composited "mixed" file.
 *
 * The engine does not know about Supabase or UI — `onResult` fires per file
 * with a Blob the caller uploads however it wants.
 */

export type Layout = "grid" | "spotlight" | "single";

export type SourceKind = "self-cam" | "self-mic" | "camera" | "mic" | "screen" | "remote";

export type SourceSpec = {
  id: string;            // stable across renders
  kind: SourceKind;
  label: string;
  deviceId?: string;     // for camera / mic
  peerUserId?: string;   // for remote
};

export type LiveSource = SourceSpec & {
  stream: MediaStream;
  hasVideo: boolean;
  hasAudio: boolean;
  /** Peak [0..1] sampled from an AnalyserNode for live VU. */
  level: () => number;
};

export type RecordedFile = {
  sourceId: string | "mixed";
  label: string;
  kind: "mixed" | SourceKind;
  blob: Blob;
  mime: string;
  durationMs: number;
};

const MIX_FPS = 24;

function pickVideoMime(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  return "video/webm";
}
function pickAudioMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm"];
  for (const c of candidates) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  return "audio/webm";
}

export class RecorderEngine {
  private ac: AudioContext | null = null;
  private mixDest: MediaStreamAudioDestinationNode | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private canvasStream: MediaStream | null = null;
  private rafId: number | null = null;

  /** id -> { stream, video?, analyser, peak } */
  private sources = new Map<string, {
    spec: SourceSpec;
    stream: MediaStream;
    ownsStream: boolean;     // false for streams owned elsewhere (self-cam, remote)
    video?: HTMLVideoElement;
    analyser?: AnalyserNode;
    audioNode?: MediaStreamAudioSourceNode;
    peakRef: { value: number };
  }>();

  /** Recorders keyed by sourceId or "mixed". */
  private recorders = new Map<string, { rec: MediaRecorder; chunks: Blob[]; mime: string; kind: RecordedFile["kind"]; label: string }>();

  private startedAt = 0;
  layout: Layout = "grid";
  spotlightId: string | null = null;

  // --- public ---------------------------------------------------------------

  async addSource(spec: SourceSpec, providedStream?: MediaStream): Promise<LiveSource> {
    if (this.sources.has(spec.id)) return this.toLive(spec.id);
    let stream: MediaStream;
    let ownsStream = true;

    if (providedStream) {
      stream = providedStream;
      ownsStream = false;
    } else if (spec.kind === "camera") {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: spec.deviceId ? { exact: spec.deviceId } : undefined },
        audio: false,
      });
    } else if (spec.kind === "mic") {
      stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          deviceId: spec.deviceId ? { exact: spec.deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } else if (spec.kind === "screen") {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: MIX_FPS } },
        audio: true,
      });
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        this.onSourceEnded?.(spec.id);
      });
    } else {
      throw new Error("addSource: no stream provided for " + spec.kind);
    }

    const entry = {
      spec,
      stream,
      ownsStream,
      peakRef: { value: 0 },
    } as NonNullable<ReturnType<RecorderEngine["sources"]["get"]>>;

    // Hidden <video> element so canvas can draw the frames.
    if (stream.getVideoTracks().length > 0) {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.autoplay = true;
      v.srcObject = stream;
      v.play().catch(() => {});
      entry.video = v;
    }

    // VU meter via AnalyserNode.
    if (stream.getAudioTracks().length > 0) {
      const ac = this.ensureAudioContext();
      const node = ac.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      node.connect(analyser);
      // Route into the mix destination too.
      node.connect(this.mixDest!);
      entry.audioNode = node;
      entry.analyser = analyser;
    }

    this.sources.set(spec.id, entry);
    return this.toLive(spec.id);
  }

  removeSource(id: string) {
    const e = this.sources.get(id);
    if (!e) return;
    try { e.audioNode?.disconnect(); } catch { /* ignore */ }
    if (e.video) { try { e.video.pause(); e.video.srcObject = null; } catch { /* ignore */ } }
    if (e.ownsStream) for (const t of e.stream.getTracks()) t.stop();
    this.sources.delete(id);
    if (this.spotlightId === id) this.spotlightId = null;
  }

  listSources(): LiveSource[] {
    return Array.from(this.sources.keys()).map((id) => this.toLive(id));
  }

  setLayout(layout: Layout, spotlightId?: string | null) {
    this.layout = layout;
    if (typeof spotlightId !== "undefined") this.spotlightId = spotlightId;
  }

  /** Bound by the studio component when a source self-ends (e.g. user clicks "Stop sharing"). */
  onSourceEnded: ((id: string) => void) | null = null;

  async start(): Promise<void> {
    if (this.recorders.size > 0) throw new Error("Already recording");
    if (this.sources.size === 0) throw new Error("Pick at least one source");

    this.startedAt = Date.now();

    // Set up canvas if we have any video sources.
    const videoSources = Array.from(this.sources.values()).filter((e) => !!e.video);
    if (videoSources.length > 0) {
      this.canvas = document.createElement("canvas");
      this.canvas.width = 1280;
      this.canvas.height = 720;
      this.canvasStream = this.canvas.captureStream(MIX_FPS);
      this.tickCanvas();
    }

    // Mixed recorder.
    const ac = this.ensureAudioContext();
    const mixTracks: MediaStreamTrack[] = [];
    if (this.canvasStream) mixTracks.push(...this.canvasStream.getVideoTracks());
    if (this.mixDest && this.mixDest.stream.getAudioTracks().length > 0) {
      mixTracks.push(...this.mixDest.stream.getAudioTracks());
    }
    if (mixTracks.length > 0) {
      const mixStream = new MediaStream(mixTracks);
      const mime = this.canvasStream ? pickVideoMime() : pickAudioMime();
      const rec = new MediaRecorder(mixStream, { mimeType: mime });
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data); };
      this.recorders.set("mixed", { rec, chunks, mime, kind: "mixed", label: "Mixed take" });
      rec.start(1000);
    }

    // Per-source recorders.
    for (const e of this.sources.values()) {
      const hasVideo = e.stream.getVideoTracks().length > 0;
      const hasAudio = e.stream.getAudioTracks().length > 0;
      if (!hasVideo && !hasAudio) continue;
      const tracks = [
        ...e.stream.getVideoTracks().map((t) => t.clone()),
        ...e.stream.getAudioTracks().map((t) => t.clone()),
      ];
      const s = new MediaStream(tracks);
      const mime = hasVideo ? pickVideoMime() : pickAudioMime();
      const rec = new MediaRecorder(s, { mimeType: mime });
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data); };
      this.recorders.set(e.spec.id, { rec, chunks, mime, kind: e.spec.kind, label: e.spec.label });
      rec.start(1000);
    }

    void ac; // touched to ensure live AudioContext
  }

  async stop(): Promise<RecordedFile[]> {
    const out: RecordedFile[] = [];
    const durationMs = Date.now() - this.startedAt;
    const stopPromises: Promise<void>[] = [];
    for (const [id, entry] of this.recorders.entries()) {
      stopPromises.push(new Promise<void>((resolve) => {
        entry.rec.addEventListener("stop", () => {
          const blob = new Blob(entry.chunks, { type: entry.mime });
          out.push({
            sourceId: id === "mixed" ? "mixed" : id,
            label: entry.label,
            kind: entry.kind,
            blob,
            mime: entry.mime,
            durationMs,
          });
          resolve();
        }, { once: true });
        if (entry.rec.state !== "inactive") entry.rec.stop();
      }));
    }
    await Promise.all(stopPromises);
    this.recorders.clear();
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.canvasStream?.getTracks().forEach((t) => t.stop());
    this.canvasStream = null;
    this.canvas = null;
    // Sort: mixed first, then by label.
    out.sort((a, b) => (a.sourceId === "mixed" ? -1 : b.sourceId === "mixed" ? 1 : a.label.localeCompare(b.label)));
    return out;
  }

  /** Hard teardown — stop all streams & audio. Call when the panel unmounts. */
  dispose() {
    for (const id of Array.from(this.sources.keys())) this.removeSource(id);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    try { this.ac?.close(); } catch { /* ignore */ }
    this.ac = null;
    this.mixDest = null;
  }

  // --- internals ------------------------------------------------------------

  private ensureAudioContext(): AudioContext {
    if (this.ac) return this.ac;
    const AC: typeof AudioContext =
      (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    this.ac = new AC();
    this.mixDest = this.ac.createMediaStreamDestination();
    return this.ac;
  }

  private toLive(id: string): LiveSource {
    const e = this.sources.get(id)!;
    return {
      ...e.spec,
      stream: e.stream,
      hasVideo: e.stream.getVideoTracks().length > 0,
      hasAudio: e.stream.getAudioTracks().length > 0,
      level: () => {
        const an = e.analyser;
        if (!an) return 0;
        const buf = new Uint8Array(an.fftSize);
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        e.peakRef.value = e.peakRef.value * 0.7 + peak * 0.3;
        return e.peakRef.value;
      },
    };
  }

  private tickCanvas = () => {
    const c = this.canvas;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, c.width, c.height);

    const videoEntries = Array.from(this.sources.values()).filter((e) => !!e.video);
    if (videoEntries.length > 0) {
      if (this.layout === "single") {
        const target = videoEntries.find((e) => e.spec.id === this.spotlightId) ?? videoEntries[0];
        drawCover(ctx, target.video!, 0, 0, c.width, c.height);
      } else if (this.layout === "spotlight" && videoEntries.length > 1) {
        const spot = videoEntries.find((e) => e.spec.id === this.spotlightId) ?? videoEntries[0];
        const strip = videoEntries.filter((e) => e !== spot);
        const stripH = 140;
        drawCover(ctx, spot.video!, 0, 0, c.width, c.height - stripH);
        const cell = Math.min(220, Math.floor((c.width - 16) / strip.length) - 8);
        const cellH = stripH - 16;
        let x = 8;
        const y = c.height - stripH + 8;
        for (const e of strip) {
          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(x, y, cell, cellH);
          drawCover(ctx, e.video!, x, y, cell, cellH);
          x += cell + 8;
        }
      } else {
        // grid
        const n = videoEntries.length;
        const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
        const rows = Math.ceil(n / cols);
        const cellW = Math.floor(c.width / cols);
        const cellH = Math.floor(c.height / rows);
        videoEntries.forEach((e, i) => {
          const r = Math.floor(i / cols);
          const col = i % cols;
          drawCover(ctx, e.video!, col * cellW, r * cellH, cellW, cellH);
        });
      }
    }

    this.rafId = requestAnimationFrame(this.tickCanvas);
  };
}

function drawCover(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, x: number, y: number, w: number, h: number) {
  if (!v.videoWidth || !v.videoHeight) return;
  const vr = v.videoWidth / v.videoHeight;
  const cr = w / h;
  let sx = 0, sy = 0, sw = v.videoWidth, sh = v.videoHeight;
  if (vr > cr) {
    sw = v.videoHeight * cr;
    sx = (v.videoWidth - sw) / 2;
  } else {
    sh = v.videoWidth / cr;
    sy = (v.videoHeight - sh) / 2;
  }
  ctx.drawImage(v, sx, sy, sw, sh, x, y, w, h);
}
