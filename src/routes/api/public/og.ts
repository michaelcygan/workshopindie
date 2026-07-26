import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { generateOgCard } from "@/lib/og-card";
import { z } from "zod";

const querySchema = z.object({
  type: z.enum(["profile", "work", "event", "workshop", "collab", "city", "blog", "default"]),
  id: z.string().min(1).max(120),
});

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const Route = createFileRoute("/api/public/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = querySchema.safeParse({
          type: url.searchParams.get("type") ?? "default",
          id: url.searchParams.get("id") ?? "",
        });
        if (!parsed.success) {
          const svg = generateOgCard({ type: "default", title: "Workshop" });
          return new Response(svg, { status: 200, headers: { "Content-Type": "image/svg+xml" } });
        }

        const { type, id } = parsed.data;
        const sb = publicClient();
        let input: Parameters<typeof generateOgCard>[0] = { type: "default", title: "Workshop" };

        try {
          switch (type) {
            case "profile": {
              const { data: p } = await sb
                .from("profiles")
                .select("display_name,username,headline,bio,avatar_url,categories")
                .eq("username", id)
                .maybeSingle();
              if (p) {
                input = {
                  type: "profile",
                  title: p.display_name || p.username || "Workshop",
                  subtitle: p.headline || p.bio,
                  image: p.avatar_url,
                  accent: Array.isArray(p.categories) && p.categories.length > 0 ? p.categories[0] : null,
                  detail: "workshopindie.com",
                };
              }
              break;
            }
            case "work": {
              const { data: w } = await sb
                .from("works")
                .select("title,excerpt,description,cover_url,category")
                .eq("slug", id)
                .eq("status", "published")
                .in("visibility", ["public", "unlisted"])
                .maybeSingle();
              if (w) {
                input = {
                  type: "work",
                  title: w.title,
                  subtitle: w.excerpt || w.description,
                  image: w.cover_url,
                  accent: w.category,
                  detail: "View on Workshop",
                };
              }
              break;
            }
            case "event": {
              const { data: e } = await sb
                .from("group_events")
                .select("title,tagline,description,cover_url,kind,group:groups!group_events_group_id_fkey!inner(name)")
                .eq("slug", id)
                .is("deleted_at", null)
                .eq("visibility", "public")
                .maybeSingle();
              if (e) {
                const group = (e as unknown as { group: { name: string } }).group;
                input = {
                  type: "event",
                  title: e.title,
                  subtitle: e.tagline || e.description,
                  image: e.cover_url,
                  accent: e.kind ?? undefined,
                  detail: group?.name ? `Hosted by ${group.name}` : "",
                };
              }
              break;
            }
            case "workshop": {
              const { data: w } = await sb
                .from("workshops")
                .select("title,prompt,category,host:profiles!workshops_host_user_id_fkey(display_name)")
                .eq("slug", id)
                .in("status", ["open", "check_in", "active", "finalizing", "shipped"])
                .maybeSingle();
              if (w) {
                const host = (w as unknown as { host: { display_name: string | null } | null }).host;
                input = {
                  type: "workshop",
                  title: w.title,
                  subtitle: w.prompt,
                  accent: w.category,
                  detail: host?.display_name ? `Hosted by ${host.display_name}` : "",
                };
              }
              break;
            }
            case "collab": {
              const { data: c } = await sb
                .from("collab_posts")
                .select("title,description,status,category")
                .eq("slug", id)
                .eq("status", "open")
                .maybeSingle();
              if (c) {
                input = {
                  type: "collab",
                  title: c.title,
                  subtitle: c.description,
                  accent: c.category,
                  detail: "Open Collab — apply now",
                };
              }
              break;
            }
            case "city": {
              const { data: c } = await sb
                .from("cities")
                .select("name,country,state_region")
                .eq("slug", id)
                .maybeSingle();
              if (c) {
                input = {
                  type: "city",
                  title: c.name,
                  subtitle: [c.state_region, c.country].filter(Boolean).join(", "),
                  detail: "Creative community on Workshop",
                };
              }
              break;
            }
            case "blog": {
              const { data: b } = await sb
                .from("blog_posts")
                .select("title,excerpt,status,cover_url")
                .eq("slug", id)
                .eq("status", "published")
                .maybeSingle();
              if (b) {
                input = {
                  type: "blog",
                  title: b.title,
                  subtitle: b.excerpt,
                  image: b.cover_url,
                  detail: "Read on Workshop",
                };
              }
              break;
            }
          }
        } catch {
          input = { type: "default", title: "Workshop" };
        }

        const svg = generateOgCard(input);
        return new Response(svg, {
          status: 200,
          headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "public, max-age=3600, s-maxage=7200",
          },
        });
      },
    },
  },
});
