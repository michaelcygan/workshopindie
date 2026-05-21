import { MapPin, Globe2 } from "lucide-react";
import type { SuggestedCity } from "@/lib/geo.functions";

/**
 * Compact strip shown above a feed when a geo-default city is active.
 * Lets the user switch to "Worldwide" or apply the suggested city when
 * they're currently browsing worldwide.
 */
export function GeoDefaultBanner({
  defaultCity,
  currentCity,
  onApply,
  onWorldwide,
}: {
  defaultCity: SuggestedCity | null | undefined;
  currentCity: string;
  onApply: (slug: string) => void;
  onWorldwide: () => void;
}) {
  if (!defaultCity) return null;

  const isOnDefault = currentCity === defaultCity.slug;
  const isWorldwide = currentCity === "all";

  if (!isOnDefault && !isWorldwide) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1">
        <MapPin className="h-3 w-3 text-primary" />
        {isOnDefault ? (
          <>
            Showing{" "}
            <span className="text-ink">{defaultCity.name}</span>
            {defaultCity.source === "ip" && (
              <span className="text-ink-muted"> · based on your location</span>
            )}
          </>
        ) : (
          <>
            Near you:{" "}
            <button
              type="button"
              onClick={() => onApply(defaultCity.slug)}
              className="text-ink underline underline-offset-2 hover:text-primary"
            >
              {defaultCity.name}
            </button>
          </>
        )}
      </span>
      {isOnDefault ? (
        <button
          type="button"
          onClick={onWorldwide}
          className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-ink-muted hover:bg-muted hover:text-ink"
        >
          <Globe2 className="h-3 w-3" />
          See worldwide
        </button>
      ) : null}
    </div>
  );
}
