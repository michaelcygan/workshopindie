import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { CollabBoard, type BoardSearch, type Format } from "@/components/collab/collab-board";
import { campaignParams, secondaryFilterSchema, secondaryParams } from "@/lib/collab/board-search";

const searchSchema = z
  .object({
    // Free string so legacy links (?cat=film / visual / build) still resolve; normalized below.
    city: z
      .string()
      .uuid()
      .catch(undefined as unknown as string)
      .optional(),
    cityName: z
      .string()
      .catch(undefined as unknown as string)
      .optional(),
    /** Legacy param — still honoured, normalized to /collab/remote. */
    online: fallback(z.boolean(), false).default(false),
    format: fallback(z.string(), "any").default("any"),
    ...secondaryFilterSchema,
  })
  .passthrough();

export const Route = createFileRoute("/collab/")({
  validateSearch: zodValidator(searchSchema),
  // Remote has a canonical URL: normalize legacy filtered links onto it.
  beforeLoad: ({ search }) => {
    const s = search as Record<string, unknown>;
    if (s.format === "online" || s.online === true) {
      throw redirect({
        to: "/collab/remote",
        search: { ...secondaryParams(s), ...campaignParams(s) },
        replace: true,
      });
    }
  },
  head: () => ({
    meta: [
      { title: "Collabs — find people to make work with | Workshop" },
      {
        name: "description",
        content:
          "Open Collabs across music, film, writing, software, design and more. Browse briefs, structured roles, and join the ones that fit.",
      },
      { property: "og:title", content: "Collabs — find people to make work with" },
      {
        property: "og:description",
        content: "Browse open Collabs and join the ones that fit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CollabIndexPage,
});

function CollabIndexPage() {
  const search = Route.useSearch() as unknown as Record<string, unknown>;
  const navigate = useNavigate();

  const format: Format = search.format === "in_person" ? "in_person" : "any";
  const board: BoardSearch = {
    ...secondaryParams(search),
    city: typeof search.city === "string" ? search.city : undefined,
    cityName: typeof search.cityName === "string" ? search.cityName : undefined,
  };

  return (
    <CollabBoard
      search={board}
      format={format}
      remote={false}
      title="Collabs"
      description="Find people to make work with."
      onPatch={(next) => navigate({ to: "/collab", search: (prev) => ({ ...prev, ...next }) as never })}
      onFormatChange={(next) => {
        if (next === "online") {
          navigate({
            to: "/collab/remote",
            search: { ...secondaryParams(search), ...campaignParams(search) },
          });
          return;
        }
        navigate({
          to: "/collab",
          search: (prev) => ({ ...(prev as object), format: next, online: false }) as never,
        });
      }}
      onClear={() =>
        navigate({ to: "/collab", search: { ...campaignParams(search) } as never })
      }
    />
  );
}
