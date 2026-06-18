import { Link } from "@tanstack/react-router";
import { Radio, Megaphone } from "lucide-react";

type Props = { slug: string };

/**
 * Quick-action overlay shown on group card hover (desktop).
 * Stops propagation so the parent card link doesn't intercept.
 */
export function GroupCardActions({ slug }: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-x-2 bottom-2 z-10 hidden translate-y-1 items-center gap-1.5 opacity-0 transition group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 md:flex"
      onClick={(e) => e.stopPropagation()}
    >
      <Link
        to="/workshops/new"
        search={{ group: slug }}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 rounded-full bg-ink/90 px-2.5 py-1.5 text-center text-[11px] font-medium text-background shadow-soft backdrop-blur transition hover:bg-ink"
      >
        <Radio className="mr-1 inline h-3 w-3" />
        Workshop
      </Link>
      <Link
        to="/collab/new"
        search={{ group: slug }}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 rounded-full bg-background/95 px-2.5 py-1.5 text-center text-[11px] font-medium text-ink shadow-soft backdrop-blur transition hover:bg-background"
      >
        <Megaphone className="mr-1 inline h-3 w-3" />
        Collab
      </Link>
    </div>
  );
}
