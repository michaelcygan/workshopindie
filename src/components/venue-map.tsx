import { useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";

export function VenueMap({
  lat,
  lng,
  label,
  className,
}: {
  lat: number;
  lng: number;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      const L = (await import("leaflet")).default;
      // Inject Leaflet CSS once
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

      // Default marker icon fix for bundlers
      const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
      const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
      const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";
      const DefaultIcon = L.icon({
        iconRetinaUrl,
        iconUrl,
        shadowUrl,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      L.Marker.prototype.options.icon = DefaultIcon;

      // Tear down any prior instance
      // @ts-expect-error runtime guard
      if (mapRef.current?.remove) (mapRef.current as { remove: () => void }).remove();

      const map = L.map(ref.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      }).setView([lat, lng], 15);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      const marker = L.marker([lat, lng]).addTo(map);
      if (label) marker.bindPopup(label);
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      // @ts-expect-error runtime guard
      if (mapRef.current?.remove) (mapRef.current as { remove: () => void }).remove();
      mapRef.current = null;
    };
  }, [lat, lng, label]);

  return (
    <div className={className}>
      <div
        ref={ref}
        className="h-[260px] w-full overflow-hidden rounded-2xl border border-border bg-muted"
        aria-label="Venue map"
      />
      <a
        href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs text-gradient-motion hover:underline"
      >
        Open in OpenStreetMap <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
