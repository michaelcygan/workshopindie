import { useEffect, useMemo, useRef, useState } from "react";
import { geoOrthographic, geoPath, geoInterpolate, geoContains } from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import landRaw from "@/assets/land-110m.json";

const land = landRaw as unknown as FeatureCollection<Polygon | MultiPolygon>;
// Flatten into a single Feature for fast geoContains tests
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
type Pair = { from: City; to: City; verb: string };

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
};

const PAIRS: Pair[] = [
  { from: CITIES.lagos, to: CITIES.berlin, verb: "Scoring a short film" },
  { from: CITIES.saopaulo, to: CITIES.tokyo, verb: "Co-writing a track" },
  { from: CITIES.cdmx, to: CITIES.lisbon, verb: "Cover photography" },
  { from: CITIES.nairobi, to: CITIES.toronto, verb: "Edit pass" },
  { from: CITIES.seoul, to: CITIES.paris, verb: "Album artwork" },
  { from: CITIES.mumbai, to: CITIES.nyc, verb: "Voice on a chorus" },
  { from: CITIES.bali, to: CITIES.capetown, verb: "Doc footage" },
  { from: CITIES.buenosaires, to: CITIES.sydney, verb: "Mixing a single" },
  { from: CITIES.toronto, to: CITIES.lagos, verb: "Beat trade" },
  { from: CITIES.paris, to: CITIES.cdmx, verb: "Set design" },
  { from: CITIES.tokyo, to: CITIES.nairobi, verb: "Animation cels" },
  { from: CITIES.berlin, to: CITIES.saopaulo, verb: "Remix swap" },
];

// Generate a dense lon/lat grid, keep only land points
function buildLandDots(): Array<[number, number]> {
  const dots: Array<[number, number]> = [];
  // golden-spiral-ish sampling: uniform on sphere
  const N = 6000;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2; // -1..1
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lon = ((i * 137.508) % 360) - 180;
    if (geoContains(landFeature, [lon, lat])) dots.push([lon, lat]);
  }
  return dots;
}

const REDUCE_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function WorldArcs({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 800 });
  const [lambda, setLambda] = useState(20); // rotation longitude
  const [now, setNow] = useState(0);
  const inViewRef = useRef(true);
  const dots = useMemo(() => buildLandDots(), []);

  // Resize observer
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(320, r.width), h: Math.max(320, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Visibility observer
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      inViewRef.current = e.isIntersecting;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // rAF loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      if (inViewRef.current && !REDUCE_MOTION) {
        setLambda((l) => (l + dt * 0.006) % 360); // ~60s/rev
        setNow(t);
      } else {
        setNow(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { w, h } = size;
  const radius = Math.min(w, h) * 0.46;

  const projection = useMemo(() => {
    return geoOrthographic()
      .translate([w / 2, h / 2])
      .scale(radius)
      .rotate([-lambda, -18, 0])
      .clipAngle(90);
  }, [w, h, radius, lambda]);

  // Draw dots to canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr;
    c.height = h * dpr;
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Sphere subtle fill
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fill();

    // Land dots
    const rotate = projection.rotate();
    const lam = -rotate[0] * (Math.PI / 180);
    const phi = -rotate[1] * (Math.PI / 180);
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    for (const [lon, lat] of dots) {
      const l = (lon * Math.PI) / 180 - lam;
      const p = (lat * Math.PI) / 180;
      // 3D
      const x3 = Math.cos(p) * Math.sin(l);
      const y3 = Math.sin(p);
      const z3 = Math.cos(p) * Math.cos(l);
      // rotate around X by phi
      const yr = y3 * cosPhi - z3 * sinPhi;
      const zr = y3 * sinPhi + z3 * cosPhi;
      if (zr < 0.02) continue; // back side
      const px = w / 2 + x3 * radius;
      const py = h / 2 - yr * radius;
      const alpha = 0.25 + zr * 0.5;
      ctx.fillStyle = `hsla(14, 80%, 55%, ${alpha * 0.55})`;
      ctx.fillRect(px - 0.6, py - 0.6, 1.2, 1.2);
    }
  }, [dots, projection, w, h, radius]);

  // Arcs: cycle through pairs, each has a 6s lifecycle, staggered
  const CYCLE = 7000;
  const STAGGER = 1700;
  const arcs = PAIRS.map((p, i) => {
    const local = ((now - i * STAGGER) % (CYCLE * PAIRS.length) + CYCLE * PAIRS.length) % (CYCLE * PAIRS.length);
    if (local > CYCLE) return null;
    const t = local / CYCLE; // 0..1
    return { pair: p, t, idx: i };
  });

  const pathGen = geoPath(projection);

  function arcFeature(pair: Pair, t: number) {
    const interp = geoInterpolate([pair.from.lon, pair.from.lat], [pair.to.lon, pair.to.lat]);
    const steps = 48;
    const end = Math.min(1, t * 1.6);
    const coords: [number, number][] = [];
    for (let s = 0; s <= steps; s++) {
      const u = (s / steps) * end;
      coords.push(interp(u) as [number, number]);
    }
    return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } } as Feature;
  }

  function project(lon: number, lat: number) {
    const p = projection([lon, lat]);
    if (!p) return null;
    // visibility test via rotation
    const rotate = projection.rotate();
    const lam = -rotate[0] * (Math.PI / 180);
    const phi = -rotate[1] * (Math.PI / 180);
    const l = (lon * Math.PI) / 180 - lam;
    const ph = (lat * Math.PI) / 180;
    const y3 = Math.sin(ph);
    const z3 = Math.cos(ph) * Math.cos(l);
    const zr = y3 * Math.sin(phi) + z3 * Math.cos(phi);
    if (zr < 0) return null;
    return p;
  }

  return (
    <div ref={wrapRef} className={className}>
      <canvas ref={canvasRef} className="absolute inset-0" />
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="absolute inset-0 pointer-events-none"
      >
        <defs>
          <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(14 90% 60%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(14 90% 60%)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="hsl(330 85% 65%)" stopOpacity="0.95" />
          </linearGradient>
          <radialGradient id="pinGlow">
            <stop offset="0%" stopColor="hsl(14 90% 60%)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="hsl(14 90% 60%)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* sphere outline */}
        <circle cx={w / 2} cy={h / 2} r={radius} fill="none" stroke="hsl(14 30% 80% / 0.35)" strokeWidth={1} />

        {arcs.map((a) => {
          if (!a) return null;
          const { pair, t, idx } = a;
          const fade = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
          const feat = arcFeature(pair, t);
          const d = pathGen(feat);
          if (!d) return null;
          const from = project(pair.from.lon, pair.from.lat);
          const to = project(pair.to.lon, pair.to.lat);
          const showLabel = t > 0.55;
          return (
            <g key={idx} opacity={fade}>
              <path d={d} fill="none" stroke="url(#arcGrad)" strokeWidth={1.25} strokeLinecap="round" />
              {from && (
                <g transform={`translate(${from[0]},${from[1]})`}>
                  <circle r={8} fill="url(#pinGlow)" />
                  <circle r={2.5} fill="hsl(14 90% 55%)" />
                </g>
              )}
              {to && t > 0.55 && (
                <g transform={`translate(${to[0]},${to[1]})`}>
                  <circle r={10} fill="url(#pinGlow)" opacity={fade} />
                  <circle r={3} fill="hsl(330 85% 60%)" />
                </g>
              )}
              {to && showLabel && (
                <foreignObject x={to[0] + 10} y={to[1] - 28} width={220} height={48}>
                  <div
                    style={{ opacity: fade }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/95 backdrop-blur px-2.5 py-1 text-[11px] text-ink shadow-soft whitespace-nowrap"
                  >
                    <span className="font-medium">{pair.from.name} → {pair.to.name}</span>
                    <span className="text-ink-soft">· {pair.verb}</span>
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
