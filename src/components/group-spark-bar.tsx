import { Link } from "@tanstack/react-router";
import { Radio, Megaphone, LayoutGrid } from "lucide-react";

type Props = { slug: string };

/**
 * Visible 3-button "spark" bar shown on md+ on the Group page.
 * Promotes creation from inside the room. Mobile uses the existing dropdown.
 */
export function GroupSparkBar({ slug }: Props) {
  return (
    <div className="hidden items-center gap-2 md:flex">
      <Link
        to="/workshops/new"
        search={{ group: slug }}
        className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-sm font-medium text-background shadow-soft transition hover:opacity-90"
      >
        <Radio className="h-4 w-4" />
        Start a Workshop
      </Link>
      <Link
        to="/collab/new"
        search={{ group: slug }}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-ink transition hover:bg-muted"
      >
        <Megaphone className="h-4 w-4" />
        Post a Collab
      </Link>
      <Link
        to="/works/new"
        search={{ group: slug }}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-ink transition hover:bg-muted"
      >
        <LayoutGrid className="h-4 w-4" />
        Share Work
      </Link>
    </div>
  );
}
