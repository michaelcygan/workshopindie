import { useEffect, useMemo, useRef } from "react";

export type MapEventPoint = {
  id: string;
  title: string;
  starts_at: string;
  lat: number;
  lng: number;
  going_count?: number | null;
  href: string;
};

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Lite, brand-styled Leaflet map of the events currently in view.
 * Leaflet is dynamically imported inside useEffect so SSR never touches it.
 */
export function EventsMiniMap({
  points,
  className,
  height = 280,
}: {
  points: MapEventPoint[];
  className?: string;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);

  // Stable key so we only rebuild markers when the set actually changes.
  const sig = useMemo(
    () => points.map((p) => `${p.id}:${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|"),
    [points],
  );
  const pointsRef = useRef(points);
  pointsRef.current = points;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      const L = (await import("leaflet")).default;

      const cssId = "leaflet-css";
      if (!document.getElementById(cssId)) {
        const link = document.createElement("link");
        link.id = cssId;
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.crossOrigin = "";
        document.head.appendChild(link);
      }

      if (cancelled || !ref.current) return;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const pts = pointsRef.current;
      const map = L.map(ref.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
        attribution: "© OpenStreetMap © CARTO",
      }).addTo(map);

      const signal = cssVar("--signal", "#3157E0");
      const maxGoing = Math.max(1, ...pts.map((p) => p.going_count ?? 0));

      for (const p of pts) {
        const weight = (p.going_count ?? 0) / maxGoing;
        const r = 5 + weight * 6;
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: r,
          color: signal,
          weight: 1.5,
          fillColor: signal,
          fillOpacity: 0.35 + weight * 0.35,
        }).addTo(map);
        const when = new Date(p.starts_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
        const esc = (s: string) =>
          s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
        marker.bindTooltip(`${esc(p.title)} · ${when}`, { direction: "top", opacity: 0.95 });
        marker.bindPopup(
          `<a href="${esc(p.href)}" style="font-weight:600;text-decoration:none">${esc(p.title)}</a><br/><span style="opacity:.7">${when}</span>`,
        );
      }

      if (pts.length === 1) {
        map.setView([pts[0]!.lat, pts[0]!.lng], 12);
      } else if (pts.length > 1) {
        map.fitBounds(
          L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])),
          { padding: [28, 28], maxZoom: 12 },
        );
      } else {
        map.setView([39.5, -98.35], 3);
      }

      mapRef.current = map as unknown as { remove: () => void };
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
    };
  }, [sig]);

  return (
    <div className={className}>
      <div
        ref={ref}
        style={{ height }}
        className="w-full overflow-hidden rounded-2xl border border-border bg-muted [&_.leaflet-container]:bg-muted"
        aria-label="Map of events"
      />
    </div>
  );
}
