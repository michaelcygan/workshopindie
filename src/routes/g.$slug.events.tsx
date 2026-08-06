/**
 * /g/$slug/events — a Group's durable public Event Directory.
 *
 * A real address, not a tab: crawlable, linkable, and filterable through the
 * URL so "screenings in Chicago" is something you can send to someone.
 */
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  GroupEventDirectory,
  directoryHeading,
  type DirectoryFilters,
  type DirectoryGroup,
} from "@/components/group/group-event-directory";
import { isMediumGroupKey, type MediumGroupKey } from "@/lib/medium-groups";
import { isEventKind, isAttendance, type AttendanceFilter } from "@/lib/events/kinds";

const searchSchema = z.object({
  category: fallback(z.string(), "").default(""),
  kind: fallback(z.string(), "").default(""),
  format: fallback(z.string(), "all").default("all"),
  q: fallback(z.string(), "").default(""),
});

type SearchShape = z.infer<typeof searchSchema>;

async function fetchGroup(slug: string): Promise<DirectoryGroup> {
  const { data, error } = await supabase
    .from("groups")
    .select("id,slug,name,kind")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return data as DirectoryGroup;
}

export const Route = createFileRoute("/g/$slug/events")({
  validateSearch: zodValidator(searchSchema),
  loader: ({ params }) => fetchGroup(params.slug),
  component: GroupEventsPage,
  head: ({ params, loaderData }) => {
    const url = `https://workshopindie.com/g/${params.slug}/events`;
    if (!loaderData) {
      return {
        meta: [{ title: "Events — Workshop" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${directoryHeading(loaderData)} — Workshop`;
    const description =
      loaderData.kind === "city"
        ? `Open mics, screenings, workshops, and meetups happening in ${loaderData.name}. A living directory of independent creative events.`
        : `Events, workshops, and gatherings connected to ${loaderData.name} on Workshop.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">Group not found.</h1>
      <Button asChild className="mt-6 rounded-md">
        <Link to="/groups">Browse Groups</Link>
      </Button>
    </main>
  ),
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">Couldn't load these events.</h1>
      <p className="mt-2 text-sm text-ink-muted">{error.message}</p>
    </main>
  ),
});

function GroupEventsPage() {
  const group = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/g/$slug/events" });

  const filters: DirectoryFilters = {
    category: isMediumGroupKey(search.category) ? (search.category as MediumGroupKey) : null,
    kind: isEventKind(search.kind) ? search.kind : null,
    format: (search.format === "all" || isAttendance(search.format)
      ? search.format
      : "all") as AttendanceFilter,
    q: search.q,
  };

  const onFiltersChange = (next: Partial<DirectoryFilters>) => {
    navigate({
      replace: true,
      search: (prev: SearchShape): SearchShape => ({
        ...prev,
        ...(next.category !== undefined ? { category: next.category ?? "" } : {}),
        ...(next.kind !== undefined ? { kind: next.kind ?? "" } : {}),
        ...(next.format !== undefined ? { format: next.format } : {}),
        ...(next.q !== undefined ? { q: next.q } : {}),
      }),
    });
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-6 md:pt-10">
      <Link
        to="/g/$slug"
        params={{ slug: group.slug }}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" />
        {group.name}
      </Link>
      <div className="mt-6">
        <GroupEventDirectory
          group={group}
          filters={filters}
          onFiltersChange={onFiltersChange}
        />
      </div>
    </main>
  );
}
