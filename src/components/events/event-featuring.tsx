import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PublicEventFeature } from "@/lib/events/event-features.functions";

/**
 * "Featuring" — who this night is built around. Optional by design: an event
 * with nothing booked renders nothing at all, so the page is unchanged.
 */

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function FeatureAvatar({ feature }: { feature: PublicEventFeature }) {
  return (
    <Avatar className="h-11 w-11 shrink-0">
      <AvatarImage src={feature.profile?.avatar_url ?? undefined} alt="" />
      <AvatarFallback className="text-xs">{initials(feature.display_name)}</AvatarFallback>
    </Avatar>
  );
}

export function EventFeaturing({ features }: { features: PublicEventFeature[] }) {
  if (!features.length) return null;

  return (
    <section aria-labelledby="event-featuring-heading" className="mt-5">
      <div className="rounded-2xl border border-border bg-surface p-4 md:p-5">
        <h2
          id="event-featuring-heading"
          className="text-xs uppercase tracking-wider text-ink-muted"
        >
          Featuring
        </h2>
        <ul className="mt-3 divide-y divide-border">
          {features.map((f) => {
            const username = f.profile?.username ?? null;
            const name = f.display_name;
            return (
              <li key={f.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                {username ? (
                  <Link
                    to="/u/$username"
                    params={{ username }}
                    aria-label={`${name} on Workshop`}
                    className="shrink-0"
                  >
                    <FeatureAvatar feature={f} />
                  </Link>
                ) : (
                  <FeatureAvatar feature={f} />
                )}
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    {username ? (
                      <Link
                        to="/u/$username"
                        params={{ username }}
                        className="font-medium text-ink hover:underline"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{name}</span>
                    )}
                    <span className="text-xs uppercase tracking-wide text-ink-muted">
                      {f.role_label}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                    {f.about}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
