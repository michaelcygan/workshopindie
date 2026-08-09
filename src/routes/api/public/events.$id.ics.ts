import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildIcsFile, icsFilename } from "@/lib/events/ics";
import { eventEndsAt } from "@/lib/events/lifecycle";
import { workshopEntityUrl } from "@/lib/entities/kinds";

const SITE = "https://workshopindie.com";

/**
 * Public calendar representation of a single Event occurrence.
 *
 * Read as an anonymous visitor on purpose: Workshop's existing event access
 * rules decide what this endpoint can see, so drafts, group-only and unlisted
 * events 404 here exactly as they do for a signed-out page view. The private
 * online join URL is never selected, let alone emitted — the calendar entry
 * always points back to the Workshop event page instead.
 */
export const Route = createFileRoute("/api/public/events/$id/ics")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return new Response("Not found", { status: 404 });

        const supabase = createClient<Database>(url, key, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data, error } = await supabase
          .from("group_events")
          .select(
            "id,title,tagline,description,starts_at,ends_at,venue_name,venue_address,format,status,slug,group:groups!group_events_group_id_fkey(slug)",
          )
          .eq("id", params.id)
          .is("deleted_at", null)
          .maybeSingle();
        if (error || !data) return new Response("Not found", { status: 404 });

        type E = {
          id: string;
          title: string;
          tagline: string | null;
          description: string | null;
          starts_at: string;
          ends_at: string | null;
          venue_name: string | null;
          venue_address: string | null;
          format: string | null;
          status: string | null;
          slug: string;
          group: { slug: string } | null;
        };
        const ev = data as unknown as E;
        if (!ev.group?.slug || !ev.starts_at) return new Response("Not found", { status: 404 });

        const eventUrl = `${SITE}${workshopEntityUrl({ kind: "event", groupSlug: ev.group.slug, slug: ev.slug })}`;
        const venue = [ev.venue_name, ev.venue_address].filter(Boolean).join(", ");
        const location =
          ev.format === "online" || !venue ? "Online — RSVP on Workshop for the link" : venue;

        const description = [ev.tagline, ev.description, `View on Workshop: ${eventUrl}`]
          .filter(Boolean)
          .join("\n\n");

        const end = eventEndsAt(ev) ?? new Date(ev.starts_at).getTime();

        const ics = buildIcsFile({
          uid: ev.id,
          title: ev.title,
          description,
          location,
          url: eventUrl,
          start: ev.starts_at,
          end,
          canceled: ev.status === "canceled",
        });

        return new Response(ics, {
          headers: {
            "content-type": "text/calendar; charset=utf-8",
            "content-disposition": `attachment; filename="${icsFilename(ev.slug)}"`,
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
