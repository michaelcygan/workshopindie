import { ExternalLink, X } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type ScreeningWork = {
  id: string;
  title: string;
  slug: string;
  embed_url: string | null;
  creator_display: string | null;
  creator_username: string | null;
};

export function ScreeningStage({
  work,
  onStop,
  canStop,
}: {
  work: ScreeningWork;
  onStop: () => void;
  canStop: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-background/80">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-foreground">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          Screening
        </span>
        <span className="min-w-0 truncate font-medium text-background">{work.title}</span>
        {(work.creator_display || work.creator_username) && (
          <span className="truncate text-background/60">
            · by {work.creator_display || `@${work.creator_username}`}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Link
            to="/works/$slug"
            params={{ slug: work.slug }}
            className="inline-flex items-center gap-1 rounded-full bg-background/10 px-2 py-1 text-[11px] text-background/90 hover:bg-background/15"
            title="Open the full Work page"
          >
            <ExternalLink className="h-3 w-3" /> Open
          </Link>
          {canStop && (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex items-center gap-1 rounded-full bg-background/10 px-2 py-1 text-[11px] text-background/90 hover:bg-background/15"
              title="Stop screening for the Lounge"
            >
              <X className="h-3 w-3" /> Stop
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden rounded-b-2xl bg-black">
        {work.embed_url ? (
          <iframe
            key={work.embed_url}
            src={work.embed_url}
            title={work.title}
            className="h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-background/60">
            No playable embed for this Work.
          </div>
        )}
      </div>
    </div>
  );
}
