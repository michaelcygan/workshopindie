import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import searchWorks from "./tools/search-works";
import searchCollabs from "./tools/search-collabs";
import searchGroups from "./tools/search-groups";
import listUpcomingEvents from "./tools/list-upcoming-events";

// The OAuth issuer must be the direct Supabase host; SUPABASE_URL is rewritten
// to the .lovable.cloud proxy on publish. Only the project ref survives.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "workshop-mcp",
  title: "Workshop",
  version: "0.1.0",
  instructions:
    "Tools for Workshop, a creative collaboration network. Use `whoami` to identify the signed-in user, `search_works`/`search_collabs`/`search_groups` to find public content, and `list_upcoming_events` to see upcoming meetups and jams. All reads are scoped by the caller's Workshop permissions (RLS).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, searchWorks, searchCollabs, searchGroups, listUpcomingEvents],
});
