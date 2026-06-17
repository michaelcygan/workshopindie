import { MapPin, Radio, Lock, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export function EventLocationCard({
  format,
  venueName,
  venueAddress,
  onlineUrl,
  city,
}: {
  format: "in_person" | "online" | "hybrid";
  venueName: string | null;
  venueAddress: string | null;
  onlineUrl: string | null;
  city: string | null;
}) {
  const { user } = useAuth();
  const showInPerson = format === "in_person" || format === "hybrid";
  const showOnline = format === "online" || format === "hybrid";

  return (
    <div className="space-y-3">
      {showInPerson && (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">In person</div>
            {user ? (
              <>
                {venueName && <div className="font-medium text-ink">{venueName}</div>}
                {venueAddress && <div className="text-sm text-ink-soft">{venueAddress}</div>}
                {!venueName && !venueAddress && city && <div className="text-sm text-ink-soft">{city}</div>}
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
      {showOnline && (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft">
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
                  className="h-7 rounded-full px-2"
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
