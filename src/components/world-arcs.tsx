import { useEffect, useRef } from "react";
import { geoOrthographic, geoInterpolate, geoContains } from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import landRaw from "@/assets/land-110m.json";
import type { GlobePromo } from "@/lib/globe-promos";

const land = landRaw as unknown as FeatureCollection<Polygon | MultiPolygon>;
const landFeature = {
  type: "Feature",
  geometry: {
    type: "MultiPolygon",
    coordinates: land.features.flatMap((f) =>
      f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates,
    ),
  },
} as Feature<MultiPolygon>;

type City = { name: string; lon: number; lat: number };
type Pair = {
  from: City;
  to: City;
  verb: string;
  kind?: "work" | "collab" | "group";
  href?: string;
  title?: string;
};

const CITIES: Record<string, City> = {
  lagos: { name: "Lagos", lon: 3.38, lat: 6.52 },
  berlin: { name: "Berlin", lon: 13.4, lat: 52.52 },
  saopaulo: { name: "São Paulo", lon: -46.63, lat: -23.55 },
  tokyo: { name: "Tokyo", lon: 139.69, lat: 35.69 },
  cdmx: { name: "Mexico City", lon: -99.13, lat: 19.43 },
  lisbon: { name: "Lisbon", lon: -9.14, lat: 38.72 },
  nairobi: { name: "Nairobi", lon: 36.82, lat: -1.29 },
  toronto: { name: "Toronto", lon: -79.38, lat: 43.65 },
  seoul: { name: "Seoul", lon: 126.98, lat: 37.57 },
  paris: { name: "Paris", lon: 2.35, lat: 48.86 },
  mumbai: { name: "Mumbai", lon: 72.88, lat: 19.08 },
  nyc: { name: "New York", lon: -74.0, lat: 40.71 },
  bali: { name: "Bali", lon: 115.19, lat: -8.41 },
  capetown: { name: "Cape Town", lon: 18.42, lat: -33.92 },
  buenosaires: { name: "Buenos Aires", lon: -58.38, lat: -34.6 },
  sydney: { name: "Sydney", lon: 151.21, lat: -33.87 },
  london: { name: "London", lon: -0.13, lat: 51.51 },
  la: { name: "Los Angeles", lon: -118.24, lat: 34.05 },
  istanbul: { name: "Istanbul", lon: 28.98, lat: 41.01 },
  bangkok: { name: "Bangkok", lon: 100.5, lat: 13.76 },
  montreal: { name: "Montreal", lon: -73.57, lat: 45.5 },
  accra: { name: "Accra", lon: -0.19, lat: 5.6 },
};

const FALLBACK_PAIRS: Pair[] = [
  { from: CITIES.lagos, to: CITIES.berlin, verb: "Scoring a short film" },
  { from: CITIES.saopaulo, to: CITIES.tokyo, verb: "Co-writing a track" },
  { from: CITIES.cdmx, to: CITIES.lisbon, verb: "Cover-photo color study" },
  { from: CITIES.nairobi, to: CITIES.toronto, verb: "Late-night edit pass" },
  { from: CITIES.seoul, to: CITIES.paris, verb: "Album artwork crit" },
  { from: CITIES.mumbai, to: CITIES.nyc, verb: "Voice on a chorus" },
  { from: CITIES.bali, to: CITIES.capetown, verb: "Doc footage trade" },
  { from: CITIES.buenosaires, to: CITIES.sydney, verb: "Mixing a single" },
  { from: CITIES.london, to: CITIES.accra, verb: "Screenplay table read" },
  { from: CITIES.la, to: CITIES.seoul, verb: "Pitch your loglines" },
  { from: CITIES.istanbul, to: CITIES.montreal, verb: "Poetry round" },
  { from: CITIES.bangkok, to: CITIES.london, verb: "Type-spec crit" },
  { from: CITIES.capetown, to: CITIES.la, verb: "Stills review" },
];

function promosToPairs(promos: GlobePromo[]): Pair[] {
  return promos.map((p) => ({
    from: p.from,
    to: p.to ?? p.from,
    verb: p.verb ?? p.title,
    kind: p.kind,
    href: p.href,
    title: p.title,
  }));
}

const REDUCE_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ACTIVE_ARCS = 3;
const DRAW_MS = 1400;
const HOLD_MS = 1600;
const FADE_MS = 800;
const COOL_MS = 600;
const LIFE = DRAW_MS + HOLD_MS + FADE_MS + COOL_MS;
// Pulse ring expands the moment an arc lands.
const PULSE_MS = 1200;

type ArcSlot = { pairIdx: number; start: number; landedAt: number | null };

export function WorldArcs({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const dotsRef = useRef<Array<[number, number]> | null>(null);
  const dotAlphaRef = useRef(0);
  const inViewRef = useRef(true);
  const lastInteractionRef = useRef(0);

  // Build land dots after first paint, chunked so we never block the main thread.
  useEffect(() => {
    let cancelled = false;
    const N = 2500;
    const CHUNK = 400;
    const acc: Array<[number, number]> = [];
    let i = 0;

    const step = () => {
      if (cancelled) return;
      const end = Math.min(N, i + CHUNK);
      for (; i < end; i++) {
        const y = 1 - (i / (N - 1)) * 2;
        const lat = (Math.asin(y) * 180) / Math.PI;
        const lon = ((i * 137.508) % 360) - 180;
        if (geoContains(landFeature, [lon, lat])) acc.push([lon, lat]);
      }
      if (i < N) {
        const schedule = window.requestIdleCallback ?? window.requestAnimationFrame;
        schedule(step as IdleRequestCallback & FrameRequestCallback);
      } else {
        dotsRef.current = acc;
      }
    };
    const schedule = window.requestIdleCallback ?? window.requestAnimationFrame;
    schedule(step as IdleRequestCallback & FrameRequestCallback);
    return () => { cancelled = true; };
  }, []);

  // Visibility observer — pause rAF when offscreen.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { inViewRef.current = e.isIntersecting; });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Interaction listener for idle-slowdown.
  useEffect(() => {
    lastInteractionRef.current = performance.now();
    const bump = () => { lastInteractionRef.current = performance.now(); };
    window.addEventListener("pointermove", bump, { passive: true });
    window.addEventListener("scroll", bump, { passive: true });
    window.addEventListener("keydown", bump);
    return () => {
      window.removeEventListener("pointermove", bump);
      window.removeEventListener("scroll", bump);
      window.removeEventListener("keydown", bump);
    };
  }, []);

  // Main animation loop — fully imperative, no React state per frame.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const label = labelRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0, radius = 0, dpr = 1;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      w = Math.max(320, r.width);
      h = Math.max(320, r.height);
      dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      radius = Math.min(w, h) * 0.46;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const projection = geoOrthographic().clipAngle(90);

    let nextPair = 0;
    const t0 = performance.now();
    const slots: ArcSlot[] = Array.from({ length: ACTIVE_ARCS }, (_, i) => ({
      pairIdx: (nextPair++) % PAIRS.length,
      start: t0 + i * (LIFE / ACTIVE_ARCS),
      landedAt: null,
    }));

    let lambda = 20;
    let last = t0;
    let raf = 0;

    const cachedSamples: Array<{ idx: number; samples: [number, number][] } | null> = slots.map(() => null);

    const sampleArc = (pair: Pair): [number, number][] => {
      const interp = geoInterpolate([pair.from.lon, pair.from.lat], [pair.to.lon, pair.to.lat]);
      const N = 40;
      const out: [number, number][] = new Array(N + 1);
      for (let i = 0; i <= N; i++) out[i] = interp(i / N) as [number, number];
      return out;
    };

    const draw = (now: number) => {
      const dt = now - last;
      last = now;
      if (inViewRef.current && !REDUCE_MOTION) {
        // Idle slowdown: 40% slower after 30s with no input.
        const idleMs = now - lastInteractionRef.current;
        const speed = idleMs > 30_000 ? 0.0036 : 0.006;
        lambda = (lambda + dt * speed) % 360;
        if (dotsRef.current && dotAlphaRef.current < 1) {
          dotAlphaRef.current = Math.min(1, dotAlphaRef.current + dt / 600);
        }
      }

      projection.translate([w / 2, h / 2]).scale(radius).rotate([-lambda, -18, 0]);
      const rot = projection.rotate();
      const lam = -rot[0] * (Math.PI / 180);
      const phi = -rot[1] * (Math.PI / 180);
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);

      ctx.clearRect(0, 0, w, h);

      // Atmospheric halo — soft coral glow just outside the sphere edge.
      {
        const halo = ctx.createRadialGradient(w / 2, h / 2, radius * 0.98, w / 2, h / 2, radius * 1.18);
        halo.addColorStop(0, "rgba(232,93,58,0.18)");
        halo.addColorStop(0.6, "rgba(232,93,58,0.06)");
        halo.addColorStop(1, "rgba(232,93,58,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, radius * 1.18, 0, Math.PI * 2);
        ctx.fill();
      }

      // Sphere subtle fill
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.fill();

      // Day/night terminator — diagonal soft gradient, cool overlay on the "night" side.
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
      ctx.clip();
      const term = ctx.createLinearGradient(
        w / 2 - radius, h / 2 - radius,
        w / 2 + radius, h / 2 + radius,
      );
      term.addColorStop(0, "rgba(255,240,220,0.14)");
      term.addColorStop(0.5, "rgba(255,255,255,0)");
      term.addColorStop(1, "rgba(40,30,60,0.18)");
      ctx.fillStyle = term;
      ctx.fillRect(w / 2 - radius, h / 2 - radius, radius * 2, radius * 2);
      ctx.restore();

      // Land dots
      const dots = dotsRef.current;
      if (dots) {
        const dotA = dotAlphaRef.current;
        for (let i = 0; i < dots.length; i++) {
          const lon = dots[i][0];
          const lat = dots[i][1];
          const l = (lon * Math.PI) / 180 - lam;
          const p = (lat * Math.PI) / 180;
          const cosP = Math.cos(p);
          const x3 = cosP * Math.sin(l);
          const y3 = Math.sin(p);
          const z3 = cosP * Math.cos(l);
          const yr = y3 * cosPhi - z3 * sinPhi;
          const zr = y3 * sinPhi + z3 * cosPhi;
          if (zr < 0.02) continue;
          const px = w / 2 + x3 * radius;
          const py = h / 2 - yr * radius;
          // Lit side (upper-left, where the terminator gradient is warm) renders brighter.
          const lit = (px - (w / 2 - radius) + (h / 2 + radius - py)) / (radius * 4);
          const litBoost = 0.85 + lit * 0.3;
          const alpha = (0.4 + zr * 0.6) * dotA * litBoost;
          ctx.fillStyle = `rgba(190,70,40,${Math.min(1, alpha)})`;
          ctx.fillRect(px - 0.7, py - 0.7, 1.4, 1.4);
        }
      }

      // Sphere outline
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(160,100,80,0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Arcs
      let activeLabel: { pair: Pair; x: number; y: number; opacity: number } | null = null;
      for (let s = 0; s < slots.length; s++) {
        const slot = slots[s];
        let local = now - slot.start;
        if (local < 0) continue;
        if (local >= LIFE) {
          slot.pairIdx = nextPair++ % PAIRS.length;
          slot.start = now;
          slot.landedAt = null;
          cachedSamples[s] = null;
          local = 0;
        }
        const pair = PAIRS[slot.pairIdx];
        if (!cachedSamples[s] || cachedSamples[s]!.idx !== slot.pairIdx) {
          cachedSamples[s] = { idx: slot.pairIdx, samples: sampleArc(pair) };
        }
        const samples = cachedSamples[s]!.samples;

        let drawT = 0;
        let fade = 1;
        if (local < DRAW_MS) {
          drawT = local / DRAW_MS;
        } else if (local < DRAW_MS + HOLD_MS) {
          drawT = 1;
          if (slot.landedAt == null) slot.landedAt = now;
        } else if (local < DRAW_MS + HOLD_MS + FADE_MS) {
          drawT = 1;
          fade = 1 - (local - DRAW_MS - HOLD_MS) / FADE_MS;
        } else {
          continue;
        }

        const lastIdx = Math.floor(drawT * (samples.length - 1));
        ctx.beginPath();
        let started = false;
        let lastVisible: { x: number; y: number } | null = null;
        for (let i = 0; i <= lastIdx; i++) {
          const lon = samples[i][0];
          const lat = samples[i][1];
          const l = (lon * Math.PI) / 180 - lam;
          const p = (lat * Math.PI) / 180;
          const cosP = Math.cos(p);
          const x3 = cosP * Math.sin(l);
          const y3 = Math.sin(p);
          const z3 = cosP * Math.cos(l);
          const yr = y3 * cosPhi - z3 * sinPhi;
          const zr = y3 * sinPhi + z3 * cosPhi;
          if (zr < 0) { started = false; continue; }
          const px = w / 2 + x3 * radius;
          const py = h / 2 - yr * radius;
          if (!started) { ctx.moveTo(px, py); started = true; }
          else ctx.lineTo(px, py);
          lastVisible = { x: px, y: py };
        }
        ctx.strokeStyle = `rgba(232,93,58,${0.85 * fade})`;
        ctx.lineWidth = 1.25;
        ctx.lineCap = "round";
        ctx.stroke();

        const project = (lon: number, lat: number) => {
          const l = (lon * Math.PI) / 180 - lam;
          const p = (lat * Math.PI) / 180;
          const cosP = Math.cos(p);
          const x3 = cosP * Math.sin(l);
          const y3 = Math.sin(p);
          const z3 = cosP * Math.cos(l);
          const yr = y3 * cosPhi - z3 * sinPhi;
          const zr = y3 * sinPhi + z3 * cosPhi;
          if (zr < 0) return null;
          return { x: w / 2 + x3 * radius, y: h / 2 - yr * radius };
        };
        const from = project(pair.from.lon, pair.from.lat);
        if (from) {
          const g = ctx.createRadialGradient(from.x, from.y, 0, from.x, from.y, 9);
          g.addColorStop(0, `rgba(232,93,58,${0.55 * fade})`);
          g.addColorStop(1, "rgba(232,93,58,0)");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(from.x, from.y, 9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(232,93,58,${0.95 * fade})`;
          ctx.beginPath(); ctx.arc(from.x, from.y, 2.4, 0, Math.PI * 2); ctx.fill();
        }
        if (drawT >= 1 && lastVisible) {
          const to = project(pair.to.lon, pair.to.lat);
          const tp = to ?? lastVisible;

          // Landing pulse — expands once when the arc reaches the destination.
          if (slot.landedAt != null) {
            const since = now - slot.landedAt;
            if (since >= 0 && since < PULSE_MS) {
              const t = since / PULSE_MS;
              const r = 4 + t * 22;
              const a = (1 - t) * 0.55 * fade;
              ctx.strokeStyle = `rgba(214,68,116,${a})`;
              ctx.lineWidth = 1.25;
              ctx.beginPath();
              ctx.arc(tp.x, tp.y, r, 0, Math.PI * 2);
              ctx.stroke();
            }
          }

          const g = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, 11);
          g.addColorStop(0, `rgba(214,68,116,${0.6 * fade})`);
          g.addColorStop(1, "rgba(214,68,116,0)");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(tp.x, tp.y, 11, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(214,68,116,${0.95 * fade})`;
          ctx.beginPath(); ctx.arc(tp.x, tp.y, 3, 0, Math.PI * 2); ctx.fill();

          if (!activeLabel || fade > activeLabel.opacity) {
            activeLabel = { pair, x: tp.x, y: tp.y, opacity: fade };
          }
        }
      }

      if (label) {
        if (activeLabel) {
          label.style.opacity = String(activeLabel.opacity);
          label.style.transform = `translate(${activeLabel.x + 12}px, ${activeLabel.y - 30}px)`;
          // Hairline pill with pulsing dot + workshop name
          label.innerHTML = `
            <span class="relative inline-flex h-1.5 w-1.5 mr-1.5">
              <span class="absolute inset-0 animate-ping rounded-full bg-primary opacity-70"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary"></span>
            </span>
            <span class="text-ink">${activeLabel.pair.from.name} → ${activeLabel.pair.to.name}</span>
            <span class="mx-1 text-ink-muted/60">·</span>
            <span class="text-ink-muted">${activeLabel.pair.verb}</span>
          `;
        } else {
          label.style.opacity = "0";
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className={className ?? "relative"}>
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div
        ref={labelRef}
        className="pointer-events-none absolute left-0 top-0 inline-flex origin-top-left items-center whitespace-nowrap rounded-full border border-border bg-surface/95 px-2.5 py-1 text-[11px] shadow-soft backdrop-blur transition-opacity duration-300"
        style={{ opacity: 0 }}
      />
    </div>
  );
}
