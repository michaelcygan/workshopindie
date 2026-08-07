import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Homepage server functions. Implementation lives in `home.server.ts` so the
 * serverfn split transform can't strip sibling module-scope helpers.
 */

/**
 * Cache policy for anonymous, identical-for-everyone payloads. A short
 * s-maxage keeps the homepage feeling live while collapsing a burst of
 * cold traffic into one origin hit; stale-while-revalidate means the
 * refresh never blocks a visitor.
 *
 * Only safe on responses that carry no per-user data — do NOT add this to
 * getMemberHome, which is scoped to context.userId.
 */
const PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=600";

/** Public: Work ↔ Blog composites for "Stories around the Work". */
export const listHomeWorkStories = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("cache-control", PUBLIC_CACHE);
  const { listHomeWorkStoriesServer } = await import("@/lib/home.server");
  const { withTrace } = await import("@/lib/perf/query-trace.server");
  return withTrace("home.stories", () => listHomeWorkStoriesServer());
});

/** Authenticated: the whole member home payload in one round trip. */
export const getMemberHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getMemberHomeServer } = await import("@/lib/home.server");
    const { withTrace } = await import("@/lib/perf/query-trace.server");
    return withTrace("home.member", () => getMemberHomeServer(context.userId));
  });

/** Public: the whole logged-out homepage payload in one round trip. */
export const getPublicHome = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("cache-control", PUBLIC_CACHE);
  const { getPublicHomeServer } = await import("@/lib/home.server");
  const { withTrace } = await import("@/lib/perf/query-trace.server");
  return withTrace("home.public", () => getPublicHomeServer());
});
