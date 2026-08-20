import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { EventsDirectory, type DirectorySearch } from "@/components/events/events-directory";

/**
 * `/events/remote` — a permanent, shareable URL for the existing Remote
 * (online + hybrid) attendance filter on the one Events calendar. Same
 * directory, same cards, same event pages, same RSVP. City is not part of
 * this state, so the city params are not accepted here.
 */
const remoteSearchSchema = z.object({
  when: fallback(z.enum(["upcoming", "past"]), "upcoming").default("upcoming"),
  q: fallback(z.string(), "").default(""),
  medium: fallback(z.string(), "").default(""),
  topic: fallback(z.string(), "").default(""),
  mine: fallback(z.boolean(), false).default(false),
  kind: fallback(z.enum(["all", "coworking"]), "all").default("all"),
  daypart: fallback(z.enum(["all", "morning", "afternoon", "evening"]), "all").default("all"),
});

type RemoteSearch = z.infer<typeof remoteSearchSchema>;

const TITLE = "Remote Events — Workshop";
const DESCRIPTION =
  "Creative events you can join from anywhere: online and hybrid workshops, co-working, critiques and listening parties on Workshop.";

export const Route = createFileRoute("/events/remote")({
  validateSearch: zodValidator(remoteSearchSchema),
  component: RemoteEventsPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: "https://workshopindie.com/events/remote" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "https://workshopindie.com/events/remote" }],
  }),
});

function RemoteEventsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/events/remote" });

  return (
    <EventsDirectory
      search={search as DirectorySearch}
      format="online"
      remote
      title="Remote events"
      description="Join from anywhere — online and hybrid sessions across Workshop."
      emptyTitle="No remote events yet."
      emptyBody="Nothing remote on the calendar right now. Browse all events or host one yourself."
      onPatch={(next) => {
        const { city: _c, cityName: _cn, ...rest } = next;
        navigate({ search: (prev: RemoteSearch): RemoteSearch => ({ ...prev, ...rest }) });
      }}
      onFormatChange={(next) => {
        if (next === "online") return;
        // Leaving Remote returns to the full calendar with that attendance state.
        navigate({ to: "/events", search: { ...search, format: next } as never });
      }}
      onClear={() =>
        navigate({
          search: () => ({
            when: "upcoming" as const,
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
