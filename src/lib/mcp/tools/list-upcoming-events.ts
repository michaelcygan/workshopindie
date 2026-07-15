import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_upcoming_events",
  title: "List upcoming events",
  description: "List upcoming Workshop group events (meetups, jams, workshops). Optionally filter by group slug.",
  inputSchema: {
    group_slug: z.string().trim().min(1).optional().describe("Restrict to a single group by slug."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ group_slug, limit }, ctx) => {
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: ctx.isAuthenticated()
        ? { headers: { Authorization: `Bearer ${ctx.getToken()}` } }
        : undefined,
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let groupId: string | null = null;
    if (group_slug) {
      const { data: g } = await sb.from("groups").select("id").eq("slug", group_slug).maybeSingle();
      if (!g) return { content: [{ type: "text", text: `Group not found: ${group_slug}` }], isError: true };
      groupId = g.id;
    }
    let q = sb
      .from("group_events")
      .select("id, slug, title, tagline, starts_at, ends_at, timezone, format, kind, group_id, venue_name, going_count")
      .gte("starts_at", new Date().toISOString())
      .is("deleted_at", null)
      .order("starts_at", { ascending: true })
      .limit(limit ?? 20);
    if (groupId) q = q.eq("group_id", groupId);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { events: data ?? [] },
    };
  },
});
