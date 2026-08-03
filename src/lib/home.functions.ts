import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Homepage server functions. Implementation lives in `home.server.ts` so the
 * serverfn split transform can't strip sibling module-scope helpers.
 */

/** Public: Work ↔ Blog composites for "Stories around the Work". */
export const listHomeWorkStories = createServerFn({ method: "GET" }).handler(async () => {
  const { listHomeWorkStoriesServer } = await import("@/lib/home.server");
  return listHomeWorkStoriesServer();
});

/** Authenticated: the whole member home payload in one round trip. */
export const getMemberHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getMemberHomeServer } = await import("@/lib/home.server");
    return getMemberHomeServer(context.userId);
  });

/** Public: the whole logged-out homepage payload in one round trip. */
export const getPublicHome = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicHomeServer } = await import("@/lib/home.server");
  return getPublicHomeServer();
});
