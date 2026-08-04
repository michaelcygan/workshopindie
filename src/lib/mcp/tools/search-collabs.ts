import { NON_PUBLIC_STATUSES, RECRUITING_DEADLINE_OR } from "@/lib/collab/query";
import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "search_collabs",
  title: "Search Collabs",
  description: "Search Workshop Collabs that are accepting collaborators, by title text. Returns collabs the caller can see.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Text to match against collab titles."),
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
      .from("collab_posts")
      .select("id, slug, title, category, status, city_id, created_at")
      .ilike("title", `%${query}%`)
      .is("archived_at", null).not("status", "in", NON_PUBLIC_STATUSES).is("resulting_work_id", null).eq("applications_open", true).or(RECRUITING_DEADLINE_OR())
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { collabs: data ?? [] },
    };
  },
});
