import { MapPin, Radio, Lock, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  publicVenueDetails,
  VENUE_PUBLIC_DISCLAIMER,
  HOSTLESS_OPEN_HOUSE_NOTE,
} from "@/lib/events/workshop-venues";

export function EventLocationCard({
  format,
  venueName,
  venueAddress,
  venueLat,
  venueLng,
  onlineUrl,
  city,
  variant = "card",
  publicAddress = false,
  workshopVenueKey = null,
  hostless = false,
}: {
  format: "in_person" | "online" | "hybrid";
  venueName: string | null;
  venueAddress: string | null;
  venueLat?: number | null;
  venueLng?: number | null;
  onlineUrl: string | null;
  city: string | null;
  variant?: "card" | "embedded";
  /** Third-party listings publish their address openly — never gate it behind RSVP. */
  publicAddress?: boolean;
  /** Canonical Workshop venue reference. Only the approved public subset renders. */
  workshopVenueKey?: string | null;
  /** Hostless Open House — adds the "find the group" coordination note. */
  hostless?: boolean;
}) {
  const { user } = useAuth();
  const canSeeAddress = !!user || publicAddress;
  const showInPerson = format === "in_person" || format === "hybrid";
  // Internal classification, verification state, group triggers, automation
  // eligibility and confirmation state are never projected here.
  const venue = publicVenueDetails(workshopVenueKey);
  const showOnline = format === "online" || format === "hybrid";

  const rowCls =
    variant === "embedded"
      ? "flex items-start gap-3"
      : "flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft";

  const mapUrl = (() => {
    if (venueLat != null && venueLng != null) {
      const label = venueName ? `(${venueName})` : "";
      return `https://www.google.com/maps/search/?api=1&query=${venueLat},${venueLng}${encodeURIComponent(label)}`;
    }
    const q = [venueName, venueAddress].filter(Boolean).join(", ");
    if (!q) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  })();

  const copyAddress = () => {
    const text = [venueName, venueAddress].filter(Boolean).join(", ");
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Address copied");
  };

  return (
    <div className="space-y-3">
      {showInPerson && (
        <div className={rowCls}>
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">In person</div>
            {canSeeAddress ? (
              <>
                {(venueName || venueAddress) && mapUrl ? (
                  <div className="flex items-start gap-2">
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group min-w-0 flex-1 -mx-1 rounded-md px-1 py-0.5 hover:bg-muted/60 active:bg-muted"
                      aria-label={`Open ${venueName ?? venueAddress ?? "location"} in maps`}
                    >
                      {venueName && (
                        <div className="font-medium text-ink group-hover:underline inline-flex items-center gap-1">
                          {venueName}
                          <ExternalLink className="h-3 w-3 text-ink-muted" />
                        </div>
                      )}
                      {venueAddress && <div className="text-sm text-ink-soft">{venueAddress}</div>}
                      {!venueName && !venueAddress && city && (
                        <div className="text-sm text-ink-soft">{city}</div>
                      )}
                    </a>
                    {(venueAddress || venueName) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 rounded-md px-2"
                        onClick={copyAddress}
                        aria-label="Copy address"
                        title="Copy address"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ) : (
                  !venueName && !venueAddress && city && <div className="text-sm text-ink-soft">{city}</div>
                )}
              </>
            ) : (
              <>
                <div className="font-medium text-ink">{city ?? venueName ?? "Location TBA"}</div>
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-ink-soft">
                  <Lock className="h-3 w-3" /> RSVP to see the full address
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {showInPerson && venue && (
        <div className={variant === "embedded" ? "space-y-2" : "rounded-2xl border border-border bg-surface p-4 shadow-soft space-y-2"}>
          <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            About this place
          </div>
          <div className="text-sm text-ink-soft">
            {venue.neighborhood} · {venue.venue_type}
          </div>
          <ul className="space-y-1 text-sm text-ink-soft">
            {venue.seating_note && <li>{venue.seating_note}</li>}
            {venue.indoor_outdoor && <li>{venue.indoor_outdoor}</li>}
            {venue.age_policy && <li>{venue.age_policy}</li>}
            {venue.food_note && <li>{venue.food_note}</li>}
            {venue.wifi === true && <li>Wi-Fi available</li>}
          </ul>
          {venue.website && (
            <a
              href={venue.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Venue website <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <p className="text-xs leading-snug text-ink-muted">{VENUE_PUBLIC_DISCLAIMER}</p>
          {hostless && <p className="text-xs leading-snug text-ink-muted">{HOSTLESS_OPEN_HOUSE_NOTE}</p>}
        </div>
      )}
      {showOnline && (
        <div className={rowCls}>
          <Radio className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">Online</div>
            {user && onlineUrl ? (
              <div className="flex items-center gap-2">
                <a
                  href={onlineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Join link <ExternalLink className="h-3 w-3" />
                </a>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 rounded-md px-2"
                  onClick={() => {
                    navigator.clipboard.writeText(onlineUrl);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            ) : user ? (
              <div className="text-sm text-ink-muted">Join link will be posted by the host.</div>
            ) : (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-ink-soft">
                <Lock className="h-3 w-3" /> RSVP to get the join link
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
