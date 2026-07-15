import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "search_groups",
  title: "Search Groups",
  description: "Search Workshop Groups (city scenes and craft communities) by name.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Text to match against group names."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: ctx.isAuthenticated()
        ? { headers: { Authorization: `Bearer ${ctx.getToken()}` } }
        : undefined,
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb
      .from("groups")
      .select("id, slug, name, kind, category, city_id, member_count, tagline")
      .ilike("name", `%${query}%`)
      .is("deleted_at", null)
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { groups: data ?? [] },
    };
  },
});
