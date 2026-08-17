import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef } from "react";

export type MapVenuePoint = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  count: number;
  going: number;
  events: { id: string; title: string; starts_at: string; href: string }[];
};

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

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Lite, brand-styled Leaflet map of where events actually happen.
 * Venue pins come from geocoded addresses; cities are a fallback for events
 * that don't have coordinates yet. Leaflet is dynamically imported inside
 * useEffect so SSR never touches it.
 */
export function EventsMiniMap({
  venues,
  cities,
  className,
  height = 280,
  onSelectCity,
}: {
  venues: MapVenuePoint[];
  cities: MapCityPoint[];
  className?: string;
  height?: number;
  onSelectCity?: (city: MapCityPoint) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);

  const sig = useMemo(
    () =>
      [
        venues.map((v) => `${v.id}:${v.count}`).join("|"),
        cities.map((c) => `${c.id}:${c.count}`).join("|"),
      ].join("#"),
    [venues, cities],
  );
  const dataRef = useRef({ venues, cities });
  dataRef.current = { venues, cities };
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

      const { venues: vs, cities: cs } = dataRef.current;
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
      const maxCount = Math.max(1, ...vs.map((v) => v.count));

      // Venue pins — where the events actually are.
      for (const v of vs) {
        const weight = v.count / maxCount;
        const marker = L.circleMarker([v.lat, v.lng], {
          radius: 5 + weight * 7,
          color: signal,
          weight: 1.5,
          fillColor: signal,
          fillOpacity: 0.35 + weight * 0.35,
        }).addTo(map);

        const first = v.events[0];
        marker.bindTooltip(
          v.count === 1 && first
            ? `${esc(first.title)} · ${shortDate(first.starts_at)}`
            : `${esc(v.label)} · ${v.count} events`,
          { direction: "top", opacity: 0.95 },
        );
        const list = v.events
          .map(
            (e) =>
              `<div style="margin-top:4px"><a href="${esc(e.href)}" style="font-weight:600;text-decoration:none">${esc(e.title)}</a><br/><span style="opacity:.65">${shortDate(e.starts_at)}</span></div>`,
          )
          .join("");
        marker.bindPopup(
          `<div style="min-width:170px"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.6">${esc(v.label)}</div>${list}${
            v.count > v.events.length
              ? `<div style="margin-top:6px;opacity:.6">+${v.count - v.events.length} more</div>`
              : ""
          }</div>`,
        );
      }

      // City bubbles — only for events without a geocoded venue.
      for (const c of cs) {
        const marker = L.circleMarker([c.lat, c.lng], {
          radius: 6,
          color: signal,
          weight: 1,
          dashArray: "2 3",
          fillColor: signal,
          fillOpacity: 0.12,
        }).addTo(map);
        marker.bindTooltip(`${esc(c.name)} · ${c.count} without a venue pin`, {
          direction: "top",
          opacity: 0.95,
        });
        marker.on("click", () => selectRef.current?.(c));
      }

      const all: [number, number][] = [
        ...vs.map((v) => [v.lat, v.lng] as [number, number]),
        ...cs.map((c) => [c.lat, c.lng] as [number, number]),
      ];
      if (all.length === 1) {
        map.setView(all[0]!, 13);
      } else if (all.length > 1) {
        map.fitBounds(L.latLngBounds(all), { padding: [28, 28], maxZoom: 13 });
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
    <div className={cn("relative isolate z-0", className)}>
      <div
        ref={ref}
        style={{ height }}
        className="w-full overflow-hidden rounded-2xl border border-border bg-muted [&_.leaflet-container]:bg-muted [&_.leaflet-container]:font-sans"

        aria-label="Map of where events are happening"
      />
    </div>
  );
}
