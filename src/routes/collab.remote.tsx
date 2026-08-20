/**
 * `/collab/remote` — the canonical URL for the existing Remote filter.
 *
 * Same board, same query, same cards, same detail page: the route only fixes
 * `location_mode = "online"` on entry. Static route, so it wins over
 * `/collab/$slug`.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { CollabBoard } from "@/components/collab/collab-board";
import { campaignParams, secondaryFilterSchema, secondaryParams } from "@/lib/collab/board-search";

const searchSchema = z.object({ ...secondaryFilterSchema }).passthrough();

export const Route = createFileRoute("/collab/remote")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Remote Collaboration — Workshop" },
      {
        name: "description",
        content:
          "Find people to make work with, wherever they are. Browse open remote Collabs across music, film, writing, software, design, research, and more.",
      },
      { property: "og:title", content: "Remote Collaboration — Workshop" },
      {
        property: "og:description",
        content: "Find people to make work with, wherever they are.",
      },
      { property: "og:url", content: "https://workshopindie.com/collab/remote" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://workshopindie.com/collab/remote" }],
  }),
  component: RemoteCollabPage,
});

function RemoteCollabPage() {
  const search = Route.useSearch() as unknown as Record<string, unknown>;
  const navigate = useNavigate();

  return (
    <CollabBoard
      search={{ ...secondaryParams(search) }}
      format="online"
      remote
      title="Remote Collaboration"
      description="Find people to make work with, wherever they are."
      onPatch={(next) =>
        navigate({ to: "/collab/remote", search: (prev) => ({ ...prev, ...next }) as never })
      }
      onFormatChange={(next) => {
        if (next === "online") return;
        navigate({
          to: "/collab",
          search: {
            ...secondaryParams(search),
            ...campaignParams(search),
            ...(next === "in_person" ? { format: "in_person" } : {}),
          } as never,
        });
      }}
      onClear={() => navigate({ to: "/collab", search: { ...campaignParams(search) } as never })}
    />
  );
}
