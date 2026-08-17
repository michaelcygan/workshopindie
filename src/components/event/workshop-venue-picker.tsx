import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveVenueAndCity } from "@/lib/venues.functions";
import { listWorkshopVenues, type WorkshopVenue } from "@/lib/events/workshop-venues";
import type { VenueSelection } from "@/components/event/venue-autocomplete";

/**
 * Admin-only shortcut to the canonical Workshop venues. It sits above the
 * ordinary OpenStreetMap search — it never replaces it, and Off Color is only
 * the preferred first option, never an automatic assignment.
 *
 * Everything shown here (suitability notes, home-base marker) is internal.
 */
export function WorkshopVenuePicker({
  selectedKey,
  onSelect,
}: {
  selectedKey: string | null;
  onSelect: (venue: WorkshopVenue, resolved: VenueSelection) => void;
}) {
  const resolveFn = useServerFn(resolveVenueAndCity);
  const [busy, setBusy] = useState<string | null>(null);
  const venues = listWorkshopVenues();

  async function choose(v: WorkshopVenue) {
    setBusy(v.key);
    let resolved: VenueSelection = {
      venue_name: v.venue_name,
      venue_address: v.address,
      venue_lat: v.lat,
      venue_lng: v.lng,
    };
    if (v.lat != null && v.lng != null) {
      try {
        // City always comes back through the trusted server geography path.
        const r = await resolveFn({
          data: { name: v.venue_name, address: v.address, lat: v.lat, lng: v.lng, osm_ref: null },
        });
        resolved = {
          venue_name: r.venue_name,
          venue_address: r.venue_address,
          venue_lat: r.venue_lat,
          venue_lng: r.venue_lng,
          venue_city_id: r.city_id,
          city_label: r.city_label,
        };
      } catch {
        // Fall back to the registry snapshot; geography never blocks the form.
      }
    }
    setBusy(null);
    onSelect(v, resolved);
  }

  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        Workshop venues
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {venues.map((v) => {
          const active = selectedKey === v.key;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => void choose(v)}
              className={cn(
                "rounded-xl border p-2.5 text-left transition",
                active
                  ? "border-primary bg-primary/5"
                  : "border-border bg-surface hover:border-ink-muted",
              )}
            >
              <div className="flex items-center gap-1.5">
                {v.is_open_house_home_base && <Star className="h-3.5 w-3.5 text-primary" />}
                <span className="text-sm font-medium text-ink">{v.venue_name}</span>
                {busy === v.key && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-muted" />}
                {active && busy !== v.key && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-muted">
                {v.neighborhood} · {v.venue_type}
                {v.is_open_house_home_base ? " · Chicago home base" : ""}
              </div>
              <div className="mt-1 text-[11px] leading-snug text-ink-soft">{v.internal_note}</div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-ink-muted">
        Internal classification only — Workshop remains the organizer. Search below for any other
        venue.
      </p>
    </div>
  );
}
