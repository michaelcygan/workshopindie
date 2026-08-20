import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { EventsDirectory, type DirectorySearch } from "@/components/events/events-directory";

// Public events calendar. `/events/remote` is the same directory with the
// online attendance filter pre-applied — see events-directory.tsx.

export const eventsSearchSchema = z.object({
  when: fallback(z.enum(["upcoming", "past"]), "upcoming").default("upcoming"),
  format: fallback(z.enum(["all", "in_person", "online"]), "all").default("all"),
  city: z
    .string()
    .uuid()
    .catch(undefined as unknown as string)
    .optional(),
  cityName: z
    .string()
    .catch(undefined as unknown as string)
    .optional(),
  q: fallback(z.string(), "").default(""),
  medium: fallback(z.string(), "").default(""),
  topic: fallback(z.string(), "").default(""),
  mine: fallback(z.boolean(), false).default(false),
  kind: fallback(z.enum(["all", "coworking"]), "all").default("all"),
  daypart: fallback(z.enum(["all", "morning", "afternoon", "evening"]), "all").default("all"),
});

type SearchShape = z.infer<typeof eventsSearchSchema>;

export const Route = createFileRoute("/events/")({
  validateSearch: zodValidator(eventsSearchSchema),
  // Legacy `?format=online` links are the Remote calendar: send them to the
  // canonical URL and keep every other param (including UTM) intact.
  beforeLoad: ({ search }) => {
    if (search.format === "online") {
      const { format: _f, city: _c, cityName: _cn, ...rest } = search as SearchShape;
      throw redirect({ to: "/events/remote", search: rest as never, replace: true });
    }
  },
  component: EventsIndexPage,
  head: () => ({
    meta: [
      { title: "Events — Workshop" },
      {
        name: "description",
        content:
          "Listening parties, work-in-progress nights, networking. Public creative events on Workshop.",
      },
      { property: "og:title", content: "Events — Workshop" },
      {
        property: "og:description",
        content:
          "Listening parties, work-in-progress nights, networking. Public creative events on Workshop.",
      },
      { property: "og:url", content: "https://workshopindie.com/events" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Events — Workshop" },
      {
        name: "twitter:description",
        content: "Public creative events on Workshop.",
      },
    ],
    links: [{ rel: "canonical", href: "https://workshopindie.com/events" }],
  }),
});

function EventsIndexPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/events/" });

  return (
    <EventsDirectory
      search={search as DirectorySearch}
      format={search.format}
      remote={false}
      title="Events"
      description="Networking, listening parties, work-in-progress nights."
      emptyTitle="Nothing on the calendar."
      emptyBody="Events hosted by the Groups you join will list here."
      onPatch={(next) =>
        navigate({ search: (prev: SearchShape): SearchShape => ({ ...prev, ...next }) })
      }
      onFormatChange={(next) => {
        if (next === "online") {
          // Remote is a place, not a param.
          navigate({
            to: "/events/remote",
            search: (prev: SearchShape) => {
              const { format: _f, city: _c, cityName: _cn, ...rest } = prev;
              return rest as never;
            },
          });
          return;
        }
        navigate({ search: (prev: SearchShape): SearchShape => ({ ...prev, format: next }) });
      }}
      onClear={() =>
        navigate({
          search: () => ({
            when: "upcoming" as const,
            format: "all" as const,
            mine: false,
            kind: "all" as const,
            daypart: "all" as const,
            q: "",
            medium: "",
            topic: "",
          }),
          replace: true,
        })
      }
    />
  );
}
