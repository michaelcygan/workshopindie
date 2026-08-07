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
 * Re-running updates the stored template so manifest copy fixes reach future
 * occurrences, and never duplicates anything.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  CHICAGO_GROUP_SLUG,
  CHICAGO_SEED_EVENTS,
  CHICAGO_TIMEZONE,
  MEDIUM_GROUP_SLUG,
  seedTemplate,
} from "./chicago-events.data";

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin only");
}

const SERIES_SELECT =
  "id,series_key,group_id,recurrence_rule,duration_minutes,template,horizon_weeks,next_occurrence_at,ends_on,timezone,start_time_local,extra_group_ids";

export const seedChicagoEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { materializeSeries, zonedPartsToUtc, toZonedParts } =
      await import("@/lib/event-series.server");

    const { data: group } = await supabaseAdmin
      .from("groups")
      .select("id,city_id")
      .eq("slug", CHICAGO_GROUP_SLUG)
      .maybeSingle();
    if (!group) throw new Error("The Chicago city Group does not exist yet — provision it first.");
    const groupId = group.id as string;
    const cityId = (group.city_id as string | null) ?? null;

    // Medium Groups are resolved by slug — never hardcoded ids. The primary
    // medium is attached automatically from `creative_category`; secondary
    // mediums are attached here as additional Groups for discovery.
    const { data: mediumGroups } = await supabaseAdmin
      .from("groups")
      .select("id,slug")
      .in("slug", Object.values(MEDIUM_GROUP_SLUG));
    const mediumIdBySlug = new Map<string, string>(
      (mediumGroups ?? []).map((g) => [g.slug as string, g.id as string]),
    );
    const extraGroupsFor = (ev: (typeof CHICAGO_SEED_EVENTS)[number]) =>
      Array.from(
        new Set(
          (ev.secondary_categories ?? [])
            .map((c) => mediumIdBySlug.get(MEDIUM_GROUP_SLUG[c]))
            .filter((id): id is string => Boolean(id) && id !== groupId),
        ),
      );

    const results: {
      key: string;
      title: string;
      action: "created" | "updated" | "unchanged";
      occurrences_added: number;
    }[] = [];
    const now = new Date();

    for (const ev of CHICAGO_SEED_EVENTS) {
      const template = seedTemplate(ev, cityId);
      const [hh, mm] = (ev.cadence === "weekly" ? ev.start_local : "00:00").split(":").map(Number);

      if (ev.cadence === "weekly") {
        // Walk forward one local day at a time to the next matching weekday.
        const today = toZonedParts(now, CHICAGO_TIMEZONE);
        let cursor = new Date(Date.UTC(today.year, today.month - 1, today.day));
        let firstStart = zonedPartsToUtc(
          { year: today.year, month: today.month, day: today.day, hour: hh, minute: mm, second: 0 },
          CHICAGO_TIMEZONE,
        );
        for (let i = 0; i < 8; i += 1) {
          const candidate = zonedPartsToUtc(
            {
              year: cursor.getUTCFullYear(),
              month: cursor.getUTCMonth() + 1,
              day: cursor.getUTCDate(),
              hour: hh,
              minute: mm,
              second: 0,
            },
            CHICAGO_TIMEZONE,
          );
          if (cursor.getUTCDay() === ev.weekday && candidate > now) {
            firstStart = candidate;
            break;
          }
          cursor = new Date(cursor.getTime() + 86_400_000);
        }

        const { data: existing } = await supabaseAdmin
          .from("event_series")
          .select(SERIES_SELECT)
          .eq("series_key", ev.key)
          .maybeSingle();

        let seriesRow = existing;
        let action: "created" | "updated" = "created";

        if (!seriesRow) {
          const { data: inserted, error } = await supabaseAdmin
            .from("event_series")
            .insert({
              group_id: groupId,
              series_key: ev.key,
              recurrence_rule: "WEEKLY",
              weekday: ev.weekday,
              day_of_month: null,
              start_time_local: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`,
              duration_minutes: ev.duration_minutes,
              timezone: CHICAGO_TIMEZONE,
              template,
              horizon_weeks: 8,
              extra_group_ids: extraGroupsFor(ev),
              next_occurrence_at: firstStart.toISOString(),
              created_by: userId,
            } as never)
            .select(SERIES_SELECT)
            .single();
          if (error) throw new Error(`${ev.key}: ${error.message}`);
          seriesRow = inserted;
        } else {
          // Refresh the template so manifest corrections reach future dates.
          const { data: updated } = await supabaseAdmin
            .from("event_series")
            .update({
              template,
              duration_minutes: ev.duration_minutes,
              canceled_at: null,
              extra_group_ids: extraGroupsFor(ev),
            } as never)
            .eq("id", seriesRow.id)
            .select(SERIES_SELECT)
            .single();
          if (updated) seriesRow = updated;
          action = "updated";
        }

        const added = await materializeSeries(supabaseAdmin, seriesRow as never, userId);
        results.push({ key: ev.key, title: ev.title, action, occurrences_added: added });
        continue;
      }

      // Dated occurrences: publish exactly the dates the organizer listed.
      let added = 0;
      for (const local of ev.occurrences) {
        const [datePart, timePart] = local.split("T");
        const [y, mo, d] = datePart.split("-").map(Number);
        const [h2, m2] = (timePart ?? "00:00").split(":").map(Number);
        const startsAt = zonedPartsToUtc(
          { year: y, month: mo, day: d, hour: h2, minute: m2, second: 0 },
          CHICAGO_TIMEZONE,
        );
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
          if ((error as { code?: string }).code !== "23505")
            throw new Error(`${ev.key}: ${error.message}`);
          continue;
        }
        if (inserted) {
          await supabaseAdmin.from("event_groups").upsert(
            [
              { event_id: inserted.id as string, group_id: groupId },
              ...extraGroupsFor(ev).map((gid) => ({
                event_id: inserted.id as string,
                group_id: gid,
              })),
            ],
            {
              onConflict: "event_id,group_id",
              ignoreDuplicates: true,
            },
          );
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
