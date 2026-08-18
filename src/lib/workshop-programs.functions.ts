/**
 * Admin server functions for Workshop Event Programs.
 *
 * Every function is admin-gated with an explicit role check — being signed in
 * is never enough. Server-only modules (the materializer, the admin Supabase
 * client) are imported inside handlers so they stay out of client bundles.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ProgramRow } from "@/lib/events/workshop-programs";

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin only");
}

export type ProgramOccurrence = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  status: string;
  venue_name: string | null;
  workshop_venue_key: string | null;
  capacity: number | null;
  overflow: number | null;
  program_occurrence_key: string | null;
  rsvp_count: number;
  group_slug: string | null;
};

export type ProgramSummary = {
  program: ProgramRow;
  group_slug: string | null;
  upcoming: number;
  next_at: string | null;
  occurrences: ProgramOccurrence[];
};

/** Programs plus their live health and upcoming occurrences. */
export const listWorkshopPrograms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProgramSummary[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabase } = context;
    const nowIso = new Date().toISOString();

    const { data: rows, error } = await supabase
      .from("workshop_event_programs")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const out: ProgramSummary[] = [];
    for (const raw of (rows ?? []) as unknown as Record<string, unknown>[]) {
      const program = raw as unknown as ProgramRow;
      const { data: group } = await supabase
        .from("groups")
        .select("slug")
        .eq("id", program.group_id)
        .maybeSingle();

      const { data: evs } = await supabase
        .from("group_events")
        .select(
          "id,slug,title,starts_at,status,venue_name,workshop_venue_key,capacity,overflow,program_occurrence_key",
        )
        .eq("workshop_event_program_id", program.id)
        .gt("starts_at", nowIso)
        .is("deleted_at", null)
        .order("starts_at", { ascending: true })
        .limit(40);

      const events = (evs ?? []) as unknown as Omit<
        ProgramOccurrence,
        "rsvp_count" | "group_slug"
      >[];
      const occurrences: ProgramOccurrence[] = [];
      for (const ev of events) {
        const { count } = await supabase
          .from("group_event_rsvps")
          .select("user_id", { count: "exact", head: true })
          .eq("event_id", ev.id)
          .in("status", ["going", "maybe"]);
        occurrences.push({
          ...ev,
          rsvp_count: count ?? 0,
          group_slug: (group?.slug as string | null) ?? null,
        });
      }

      const live = occurrences.filter((o) => o.status !== "canceled");
      out.push({
        program,
        group_slug: (group?.slug as string | null) ?? null,
        upcoming: live.length,
        next_at: live[0]?.starts_at ?? null,
        occurrences,
      });
    }
    return out;
  });

/** Pause or resume automation. Published occurrences are never touched. */
export const setWorkshopProgramActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("workshop_event_programs")
      .update({ active: data.active } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, active: data.active };
  });

const venueConfigSchema = z.object({
  enabled: z.boolean(),
  capacity: z.number().int().min(1).max(500).nullable(),
  overflow: z.number().int().min(0).max(500),
  needs_review: z.boolean(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  min_age: z.number().int().min(1).max(99).nullable().optional(),
});

/** Edit program configuration. Applies to newly materialized occurrences. */
export const updateWorkshopProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(3).max(140).optional(),
        events_per_month: z.number().int().min(1).max(12).optional(),
        target_future_occurrences: z.number().int().min(1).max(24).optional(),
        min_lead_days: z.number().int().min(0).max(60).optional(),
        duration_minutes: z.number().int().min(30).max(600).optional(),
        home_base_venue_key: z.string().max(80).nullable().optional(),
        venue_config: z.record(z.string(), venueConfigSchema).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("workshop_event_programs")
      .update(patch as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Run the materializer for one program right now. */
export const topUpWorkshopProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { materializeProgram } = await import("@/lib/events/workshop-programs.server");
    const { data: row, error } = await supabaseAdmin
      .from("workshop_event_programs")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Program not found");
    const program = row as unknown as ProgramRow;
    const res = await materializeProgram(supabaseAdmin, program);
    await supabaseAdmin
      .from("workshop_event_programs")
      .update({
        last_materialized_at: new Date().toISOString(),
        last_error: res.reasons.length > 0 ? res.reasons.join(" · ").slice(0, 800) : null,
      } as never)
      .eq("id", program.id);
    return res;
  });

/**
 * Cancel every future occurrence of a program. RSVPs are notified through the
 * normal cancellation path; the program is paused so automation does not
 * immediately refill the horizon.
 */
export const cancelWorkshopProgramFuture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const nowIso = new Date().toISOString();
    const { data: rows, error } = await supabase
      .from("group_events")
      .update({ status: "canceled" } as never)
      .eq("workshop_event_program_id", data.id)
      .gt("starts_at", nowIso)
      .neq("status", "canceled")
      .select("id,title,slug,group:groups!inner(slug)");
    if (error) throw new Error(error.message);
    type R = { id: string; title: string; slug: string; group: { slug: string } };
    const canceled = (rows ?? []) as unknown as R[];

    for (const ev of canceled) {
      try {
        const { data: rsvps } = await supabase
          .from("group_event_rsvps")
          .select("user_id")
          .eq("event_id", ev.id)
          .in("status", ["going", "maybe", "waitlist"]);
        if (rsvps && rsvps.length > 0) {
          const { notifyMany } = await import("@/lib/notifications/deliver.server");
          await notifyMany({
            recipientIds: rsvps.map((r) => r.user_id as string),
            actorUserId: userId,
            kind: "event_canceled",
            entityType: "group_event",
            entityId: ev.id,
            payload: {
              event_title: ev.title,
              event_slug: ev.slug,
              group_slug: ev.group.slug,
              reason: data.reason ?? null,
            },
          });
        }
      } catch {
        /* notifications are best-effort */
      }
    }

    await supabase
      .from("workshop_event_programs")
      .update({ active: false } as never)
      .eq("id", data.id);

    return { ok: true, canceled: canceled.length };
  });

/** Cancel a single occurrence without disturbing the rest of the program. */
export const cancelProgramOccurrence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("group_events")
      .update({ status: "canceled" } as never)
      .eq("id", data.event_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
