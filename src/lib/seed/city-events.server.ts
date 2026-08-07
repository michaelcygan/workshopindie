/**
 * City-agnostic, idempotent seeding of a verified external-events manifest.
 *
 * Server-only. Used by the Chicago and Milwaukee seeds and by any future city.
 *
 * Idempotency:
 *  - `weekly` / `biweekly` entries create one `event_series` row keyed by the
 *    manifest `key` (unique `series_key`), then materialize occurrences.
 *  - `dated` entries insert `group_events` rows directly; the unique index on
 *    (series_key, starts_at) makes re-running a no-op.
 * Re-running refreshes the stored template so manifest copy fixes reach future
 * occurrences, and never duplicates anything.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  MEDIUM_GROUP_SLUG,
  buildSeedTemplate,
  type SeedEvent,
} from "./city-events.shared";
import { materializeSeries, toZonedParts, zonedPartsToUtc } from "@/lib/event-series.server";

const SERIES_SELECT =
  "id,series_key,group_id,recurrence_rule,duration_minutes,template,horizon_weeks,next_occurrence_at,ends_on,timezone,start_time_local,extra_group_ids";

export type SeedResult = {
  key: string;
  title: string;
  action: "created" | "updated" | "unchanged";
  occurrences_added: number;
};

function parseLocal(local: string): { date: [number, number, number]; time: [number, number] } {
  const [datePart, timePart] = local.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, m] = (timePart ?? "00:00").split(":").map(Number);
  return { date: [y, mo, d], time: [h, m] };
}

export async function runCitySeed(
  admin: SupabaseClient<Database>,
  opts: {
    citySlug: string;
    timezone: string;
    events: SeedEvent[];
    userId: string;
  },
): Promise<{ group_slug: string; results: SeedResult[] }> {
  const { citySlug, timezone, events, userId } = opts;

  const { data: group } = await admin
    .from("groups")
    .select("id,city_id")
    .eq("slug", citySlug)
    .maybeSingle();
  if (!group) throw new Error(`The ${citySlug} city Group does not exist yet — provision it first.`);
  const groupId = group.id as string;
  const cityId = (group.city_id as string | null) ?? null;

  // Medium Groups are resolved by slug — never hardcoded ids.
  const { data: mediumGroups } = await admin
    .from("groups")
    .select("id,slug")
    .in("slug", Object.values(MEDIUM_GROUP_SLUG));
  const mediumIdBySlug = new Map<string, string>(
    (mediumGroups ?? []).map((g) => [g.slug as string, g.id as string]),
  );
  const extraGroupsFor = (ev: SeedEvent) =>
    Array.from(
      new Set(
        (ev.secondary_categories ?? [])
          .map((c) => mediumIdBySlug.get(MEDIUM_GROUP_SLUG[c]))
          .filter((id): id is string => Boolean(id) && id !== groupId),
      ),
    );

  const results: SeedResult[] = [];
  const now = new Date();

  for (const ev of events) {
    const template = buildSeedTemplate(ev, timezone, cityId);

    if (ev.cadence === "weekly" || ev.cadence === "biweekly") {
      const rule = ev.cadence === "weekly" ? "WEEKLY" : "BIWEEKLY";
      let hh = 0;
      let mm = 0;
      let firstStart: Date;

      if (ev.cadence === "weekly") {
        [hh, mm] = ev.start_local.split(":").map(Number);
        const today = toZonedParts(now, timezone);
        let cursor = new Date(Date.UTC(today.year, today.month - 1, today.day));
        firstStart = zonedPartsToUtc(
          { year: today.year, month: today.month, day: today.day, hour: hh, minute: mm, second: 0 },
          timezone,
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
            timezone,
          );
          if (cursor.getUTCDay() === ev.weekday && candidate > now) {
            firstStart = candidate;
            break;
          }
          cursor = new Date(cursor.getTime() + 86_400_000);
        }
      } else {
        // Biweekly anchors on a verified published occurrence; the
        // materializer walks the anchor forward in 14-day steps.
        const { date, time } = parseLocal(ev.anchor_local);
        [hh, mm] = time;
        firstStart = zonedPartsToUtc(
          { year: date[0], month: date[1], day: date[2], hour: hh, minute: mm, second: 0 },
          timezone,
        );
      }

      const { data: existing } = await admin
        .from("event_series")
        .select(SERIES_SELECT)
        .eq("series_key", ev.key)
        .maybeSingle();

      let seriesRow = existing;
      let action: "created" | "updated" = "created";

      if (!seriesRow) {
        const { data: inserted, error } = await admin
          .from("event_series")
          .insert({
            group_id: groupId,
            series_key: ev.key,
            recurrence_rule: rule,
            weekday: ev.cadence === "weekly" ? ev.weekday : null,
            day_of_month: null,
            start_time_local: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`,
            duration_minutes: ev.duration_minutes,
            timezone,
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
        const { data: updated } = await admin
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

      const added = await materializeSeries(admin, seriesRow as never, userId);
      results.push({ key: ev.key, title: ev.title, action, occurrences_added: added });
      continue;
    }

    // Dated occurrences: publish exactly the dates the organizer listed.
    let added = 0;
    for (const local of ev.occurrences) {
      const { date, time } = parseLocal(local);
      const startsAt = zonedPartsToUtc(
        { year: date[0], month: date[1], day: date[2], hour: time[0], minute: time[1], second: 0 },
        timezone,
      );
      if (startsAt <= now) continue;
      const endsAt = new Date(startsAt.getTime() + ev.duration_minutes * 60_000);
      const { data: inserted, error } = await admin
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
        await admin.from("event_groups").upsert(
          [
            { event_id: inserted.id as string, group_id: groupId },
            ...extraGroupsFor(ev).map((gid) => ({
              event_id: inserted.id as string,
              group_id: gid,
            })),
          ],
          { onConflict: "event_id,group_id", ignoreDuplicates: true },
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

  return { group_slug: citySlug, results };
}
