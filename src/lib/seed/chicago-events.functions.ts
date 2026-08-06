/**
 * Idempotent seeding of the verified Chicago recurring-events manifest.
 *
 * Admin-only. Every seeded row is external provenance: Workshop is listing a
 * real event that someone else organizes, never claiming it as its own.
 *
 * Idempotency:
 *  - Weekly entries create one `event_series` row keyed by the manifest `key`
 *    (unique constraint on `series_key`), then materialize occurrences.
 *  - Dated entries insert `group_events` rows directly; the unique index on
 *    (series_key, starts_at) makes re-running a no-op.
 * Re-running the seed updates the stored template so manifest copy fixes
 * propagate to future occurrences, and never duplicates anything.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  CHICAGO_GROUP_SLUG,
  CHICAGO_SEED_EVENTS,
  CHICAGO_TIMEZONE,
  type SeedEvent,
} from "./chicago-events.data";

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin only");
}

type SeedResult = {
  key: string;
  title: string;
  action: "created" | "updated" | "unchanged";
  occurrences_added: number;
};

function templateFor(ev: SeedEvent, venueCityId: string | null): Record<string, unknown> {
  return {
    title: ev.title,
    tagline: ev.tagline,
    description: ev.description,
    kind: ev.kind,
    creative_category: ev.creative_category,
    format: "in_person",
    timezone: CHICAGO_TIMEZONE,
    venue_name: ev.venue_name,
    venue_address: ev.venue_address,
    venue_city_id: venueCityId,
    visibility: "public",
    rsvp_mode: "open",
    status: "scheduled",
    // Third-party listing. Never Workshop-official, always credited and linked.
    is_official: false,
    source: "external",
    external_url: ev.external_url,
    external_organizer: ev.external_organizer,
    is_recurring: true,
    recurrence_label: ev.recurrence_label,
  };
}

/** Parse "YYYY-MM-DDTHH:MM" local wall clock into a UTC instant in `tz`. */
function localToUtc(local: string, tz: string, zonedPartsToUtc: (p: never, t: string) => Date): Date {
  const [datePart, timePart] = local.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = (timePart ?? "00:00").split(":").map(Number);
  return zonedPartsToUtc(
    { year: y, month: mo, day: d, hour: h, minute: mi, second: 0 } as never,
    tz,
  );
}

export const seedChicagoEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { materializeSeries, zonedPartsToUtc, toZonedParts, advanceParts } = await import(
      "@/lib/event-series.server"
    );

    const { data: group } = await supabaseAdmin
      .from("groups")
      .select("id,city_id")
      .eq("slug", CHICAGO_GROUP_SLUG)
      .maybeSingle();
    if (!group) throw new Error("The Chicago city Group does not exist yet — provision it first.");
    const groupId = group.id as string;
    const cityId = (group.city_id as string | null) ?? null;

    const results: SeedResult[] = [];
    const now = new Date();

    for (const ev of CHICAGO_SEED_EVENTS) {
      const template = templateFor(ev, cityId);

      if (ev.cadence === "weekly") {
        const [h, mi] = ev.start_local.split(":").map(Number);
        // First occurrence at or after now that lands on the manifest weekday.
        let parts = toZonedParts(now, CHICAGO_TIMEZONE);
        parts = { ...parts, hour: h, minute: mi, second: 0 };
        let guard = 0;
        while (guard < 14) {
          const candidate = zonedPartsToUtc(parts, CHICAGO_TIMEZONE);
          const weekday = new Date(
            Date.UTC(parts.year, parts.month - 1, parts.day),
          ).getUTCDay();
          if (weekday === ev.weekday && candidate > now) break;
          parts = {
            ...parts,
            ...toZonedParts(
              new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1)),
              "UTC",
            ),
            hour: h,
            minute: mi,
            second: 0,
          };
          guard += 1;
        }
        const firstStart = zonedPartsToUtc(parts, CHICAGO_TIMEZONE);

        const { data: existing } = await supabaseAdmin
          .from("event_series")
          .select("id,series_key,group_id,recurrence_rule,duration_minutes,template,horizon_weeks,next_occurrence_at,ends_on,timezone,start_time_local,extra_group_ids")
          .eq("series_key", ev.key)
          .maybeSingle();

        let seriesRow = existing;
        let action: SeedResult["action"] = "unchanged";

        if (!seriesRow) {
          const { data: inserted, error } = await supabaseAdmin
            .from("event_series")
            .insert({
              group_id: groupId,
              series_key: ev.key,
              recurrence_rule: "WEEKLY",
              weekday: ev.weekday,
              day_of_month: null,
              start_time_local: `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:00`,
              duration_minutes: ev.duration_minutes,
              timezone: CHICAGO_TIMEZONE,
              template,
              horizon_weeks: 8,
              next_occurrence_at: firstStart.toISOString(),
              created_by: userId,
            } as never)
            .select("id,series_key,group_id,recurrence_rule,duration_minutes,template,horizon_weeks,next_occurrence_at,ends_on,timezone,start_time_local,extra_group_ids")
            .single();
          if (error) throw new Error(`${ev.key}: ${error.message}`);
          seriesRow = inserted;
          action = "created";
        } else {
          // Refresh the template so manifest corrections reach future dates.
          const { data: updated } = await supabaseAdmin
            .from("event_series")
            .update({ template, duration_minutes: ev.duration_minutes, canceled_at: null } as never)
            .eq("id", seriesRow.id)
            .select("id,series_key,group_id,recurrence_rule,duration_minutes,template,horizon_weeks,next_occurrence_at,ends_on,timezone,start_time_local,extra_group_ids")
            .single();
          if (updated) seriesRow = updated;
          action = "updated";
        }

        const added = await materializeSeries(supabaseAdmin, seriesRow as never, userId);
        results.push({ key: ev.key, title: ev.title, action, occurrences_added: added });
        void advanceParts;
        continue;
      }

      // Dated occurrences: publish exactly the dates the organizer listed.
      let added = 0;
      for (const local of ev.occurrences) {
        const startsAt = localToUtc(local, CHICAGO_TIMEZONE, zonedPartsToUtc as never);
        if (startsAt <= now) continue;
        const endsAt = new Date(startsAt.getTime() + ev.duration_minutes * 60_000);
        const { data: inserted, error } = await supabaseAdmin
          .from("group_events")
          .insert({
            ...template,
            is_recurring: false,
            group_id: groupId,
            series_key: ev.key,
            slug: "",
            created_by: userId,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            published_at: new Date().toISOString(),
            archived_at: null,
          } as never)
          .select("id")
          .single();
        if (error) {
          // 23505 = this date already exists. That is the idempotent path.
          if ((error as { code?: string }).code !== "23505") throw new Error(`${ev.key}: ${error.message}`);
          continue;
        }
        if (inserted) {
          await supabaseAdmin
            .from("event_groups")
            .upsert([{ event_id: inserted.id as string, group_id: groupId }], {
              onConflict: "event_id,group_id",
              ignoreDuplicates: true,
            });
          added += 1;
        }
      }
      results.push({
        key: ev.key,
        title: ev.title,
        action: added > 0 ? "created" : "unchanged",
        occurrences_added: added,
      });
    }

    return { group_slug: CHICAGO_GROUP_SLUG, results };
  });
