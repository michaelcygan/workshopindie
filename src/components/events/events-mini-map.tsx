import { useEffect, useMemo, useRef } from "react";

export type MapCityPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  count: number;
};

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Lite, brand-styled Leaflet map of where events are happening.
 * Leaflet is dynamically imported inside useEffect so SSR never touches it.
 */
export function EventsMiniMap({
  points,
  className,
  height = 280,
  onSelectCity,
}: {
  points: MapCityPoint[];
  className?: string;
  height?: number;
  onSelectCity?: (city: MapCityPoint) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);

  const sig = useMemo(() => points.map((p) => `${p.id}:${p.count}`).join("|"), [points]);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const selectRef = useRef(onSelectCity);
  selectRef.current = onSelectCity;

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
      const maxCount = Math.max(1, ...pts.map((p) => p.count));

      for (const p of pts) {
        const weight = p.count / maxCount;
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: 5 + weight * 9,
          color: signal,
          weight: 1.5,
          fillColor: signal,
          fillOpacity: 0.3 + weight * 0.35,
        }).addTo(map);
        marker.bindTooltip(`${p.name} · ${p.count} event${p.count === 1 ? "" : "s"}`, {
          direction: "top",
          opacity: 0.95,
        });
        marker.on("click", () => selectRef.current?.(p));
      }

      if (pts.length === 1) {
        map.setView([pts[0]!.lat, pts[0]!.lng], 9);
      } else if (pts.length > 1) {
        map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])), {
          padding: [30, 30],
          maxZoom: 9,
        });
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
        className="w-full overflow-hidden rounded-2xl border border-border bg-muted [&_.leaflet-container]:bg-muted [&_.leaflet-container]:font-sans"
        aria-label="Map of cities with events"
      />
    </div>
  );
}
