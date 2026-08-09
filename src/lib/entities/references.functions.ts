import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Public RPC for the one reverse-reference read. Everything it returns is
 * already publicly visible, so it is cacheable and needs no session.
 */
export const listEntityReferences = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["work", "collab", "group", "event", "post"]),
        entityId: z.string().uuid(),
        limitPerKind: z.number().int().min(1).max(12).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { listEntityReferencesServer } = await import("./references.server");
    setResponseHeader("cache-control", "public, s-maxage=60, stale-while-revalidate=600");
    return listEntityReferencesServer(data.kind, data.entityId, data.limitPerKind ?? 6);
  });
