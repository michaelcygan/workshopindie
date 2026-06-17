import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}
function toIcsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export const Route = createFileRoute("/api/public/events/$id/ics")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        const { data, error } = await supabase
          .from("group_events")
          .select("id,title,tagline,description,starts_at,ends_at,venue_name,venue_address,online_url,slug,group:groups!inner(slug,name)")
          .eq("id", params.id)
          .is("deleted_at", null)
          .maybeSingle();
        if (error || !data) return new Response("Not found", { status: 404 });
        type E = { id: string; title: string; tagline: string | null; description: string | null; starts_at: string; ends_at: string; venue_name: string | null; venue_address: string | null; online_url: string | null; slug: string; group: { slug: string; name: string } };
        const ev = data as unknown as E;
        const loc = [ev.venue_name, ev.venue_address].filter(Boolean).join(", ") || ev.online_url || "";
        const desc = [ev.tagline, ev.description].filter(Boolean).join("\n\n");
        const ics = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Workshop//Events//EN",
          "BEGIN:VEVENT",
          `UID:${ev.id}@workshopindie.com`,
          `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
          `DTSTART:${toIcsDate(ev.starts_at)}`,
          `DTEND:${toIcsDate(ev.ends_at)}`,
          `SUMMARY:${escapeIcs(ev.title)}`,
          `DESCRIPTION:${escapeIcs(desc)}`,
          loc ? `LOCATION:${escapeIcs(loc)}` : "",
          ev.online_url ? `URL:${escapeIcs(ev.online_url)}` : "",
          "END:VEVENT",
          "END:VCALENDAR",
        ].filter(Boolean).join("\r\n");
        return new Response(ics, {
          headers: {
            "content-type": "text/calendar; charset=utf-8",
            "content-disposition": `attachment; filename="${ev.slug}.ics"`,
          },
        });
      },
    },
  },
});
