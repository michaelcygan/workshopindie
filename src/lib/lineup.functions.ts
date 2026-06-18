import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const HOLD_MINUTES = 5;

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const performerSchema = z.object({
  stage_name: z.string().trim().max(80).nullable().optional(),
  act_type: z.enum(["comedian", "band", "dj", "other"]).nullable().optional(),
  link_url: z.string().trim().url().max(300).nullable().optional().or(z.literal("")),
  notes_to_host: z.string().trim().max(500).nullable().optional(),
});

type PerformerInput = z.infer<typeof performerSchema>;

function cleanPerformer(p: PerformerInput) {
  return {
    stage_name: p.stage_name?.trim() || null,
    act_type: (p.act_type ?? null) as "comedian" | "band" | "dj" | "other" | null,
    link_url: p.link_url ? String(p.link_url).trim() || null : null,
    notes_to_host: p.notes_to_host?.trim() || null,
  };
}

async function isHostOrAdmin(
  supabase: ReturnType<typeof publicClient>,
  userId: string,
  eventId: string,
): Promise<boolean> {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin) return true;
  const { data: ev } = await supabase
    .from("group_events")
    .select("created_by,group_id,groups:groups!inner(created_by)")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev) return false;
  const e = ev as { created_by: string; groups: { created_by: string | null } | null };
  return e.created_by === userId || e.groups?.created_by === userId;
}

function lockedNow(startsAt: string, lockMinutes: number) {
  return new Date(startsAt).getTime() - lockMinutes * 60_000 <= Date.now();
}

async function expireHolds(eventId: string) {
  const admin = await getAdmin();
  await admin
    .from("group_event_lineup_slots")
    .update({
      status: "open",
      claimed_by: null,
      claimed_at: null,
      stage_name: null,
      act_type: null,
      link_url: null,
      notes_to_host: null,
      hold_email: null,
      hold_expires_at: null,
    })
    .eq("event_id", eventId)
    .eq("status", "soft_hold")
    .lt("hold_expires_at", new Date().toISOString());
}

// ---- Reads ----

export const getLineupForEvent = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await expireHolds(data.event_id);
    const supabase = publicClient();
    const { data: ev, error: evErr } = await supabase
      .from("group_events")
      .select("id,starts_at,lineup_mode,lineup_field_act_type,lineup_field_link,lineup_field_notes,lineup_allow_switch,lineup_lock_minutes_before,kind")
      .eq("id", data.event_id)
      .maybeSingle();
    if (evErr) throw new Error(evErr.message);
    if (!ev) throw new Error("Event not found");

    const { data: slots, error } = await supabase
      .from("group_event_lineup_slots_public" as never)
      .select("id,event_id,position,status,claimed_by,claimed_at,manual_performer_name,stage_name,act_type,link_url,hold_expires_at")
      .eq("event_id", data.event_id)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);

    // Resolve profile chips for claimed slots
    const userIds = Array.from(new Set((slots ?? []).map((s) => (s as { claimed_by: string | null }).claimed_by).filter(Boolean) as string[]));
    let profiles: Record<string, { id: string; username: string | null; display_name: string | null; avatar_url: string | null }> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", userIds);
      for (const p of (profs ?? []) as Array<typeof profiles[string]>) profiles[p.id] = p;
    }
    return { event: ev, slots: slots ?? [], profiles };
  });

// Private fields visible only to slot owner / host / admin.
export const getMySlotPrivate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("group_event_lineup_slots")
      .select("id,position,status,stage_name,act_type,link_url,notes_to_host")
      .eq("event_id", data.event_id)
      .eq("claimed_by", userId)
      .maybeSingle();
    return row;
  });

// ---- Mutations: signed-in performer ----

export const claimSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ slot_id: z.string().uuid(), performer: performerSchema }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const admin = await getAdmin();

    const { data: slot, error } = await admin
      .from("group_event_lineup_slots")
      .select("id,event_id,status,hold_expires_at")
      .eq("id", data.slot_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!slot) throw new Error("Slot not found");

    // Allow claiming an expired hold; otherwise must be open
    const isExpiredHold =
      slot.status === "soft_hold" &&
      slot.hold_expires_at &&
      new Date(slot.hold_expires_at).getTime() < Date.now();
    if (slot.status !== "open" && !isExpiredHold) throw new Error("This spot is no longer available.");

    const { data: ev } = await admin
      .from("group_events")
      .select("starts_at,lineup_mode,lineup_lock_minutes_before,kind")
      .eq("id", slot.event_id)
      .maybeSingle();
    if (!ev || ev.kind !== "lineup") throw new Error("Not a lineup event");
    if (lockedNow(ev.starts_at, ev.lineup_lock_minutes_before)) throw new Error("Lineup is locked for this show.");

    // Get caller's email for audit
    const { data: userRow } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
    void userRow;

    // Disallow holding more than one slot per event
    const { data: existing } = await admin
      .from("group_event_lineup_slots")
      .select("id")
      .eq("event_id", slot.event_id)
      .eq("claimed_by", userId)
      .in("status", ["soft_hold", "requested", "confirmed"]);
    if ((existing ?? []).length > 0) throw new Error("You already hold a spot in this lineup.");

    const performer = cleanPerformer(data.performer);
    const newStatus = ev.lineup_mode === "host_approval" ? "requested" : "confirmed";

    const { error: upErr } = await admin
      .from("group_event_lineup_slots")
      .update({
        status: newStatus,
        claimed_by: userId,
        claimed_at: new Date().toISOString(),
        hold_email: null,
        hold_expires_at: null,
        ...performer,
      })
      .eq("id", slot.id);
    if (upErr) throw new Error(upErr.message);

    await admin.from("group_event_lineup_audit").insert({
      event_id: slot.event_id,
      slot_id: slot.id,
      actor_user_id: userId,
      action: newStatus === "requested" ? "request" : "claim",
      metadata: { performer },
    });

    return { ok: true, status: newStatus };
  });

export const releaseSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ slot_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const admin = await getAdmin();
    const { data: slot } = await admin
      .from("group_event_lineup_slots")
      .select("id,event_id,claimed_by")
      .eq("id", data.slot_id)
      .maybeSingle();
    if (!slot) throw new Error("Slot not found");
    if (slot.claimed_by !== userId) throw new Error("Not your slot");

    await admin
      .from("group_event_lineup_slots")
      .update({
        status: "open",
        claimed_by: null,
        claimed_at: null,
        stage_name: null,
        act_type: null,
        link_url: null,
        notes_to_host: null,
      })
      .eq("id", slot.id);

    await admin.from("group_event_lineup_audit").insert({
      event_id: slot.event_id,
      slot_id: slot.id,
      actor_user_id: userId,
      action: "release",
    });
    return { ok: true };
  });

export const switchSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ from_slot_id: z.string().uuid(), to_slot_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const admin = await getAdmin();
    const { data: rows } = await admin
      .from("group_event_lineup_slots")
      .select("id,event_id,status,claimed_by,stage_name,act_type,link_url,notes_to_host")
      .in("id", [data.from_slot_id, data.to_slot_id]);
    const from = rows?.find((r) => r.id === data.from_slot_id);
    const to = rows?.find((r) => r.id === data.to_slot_id);
    if (!from || !to) throw new Error("Slot not found");
    if (from.claimed_by !== userId) throw new Error("Not your slot");
    if (from.event_id !== to.event_id) throw new Error("Different events");
    if (to.status !== "open") throw new Error("Target spot is taken");

    const { data: ev } = await admin
      .from("group_events")
      .select("lineup_allow_switch,starts_at,lineup_lock_minutes_before")
      .eq("id", from.event_id)
      .maybeSingle();
    if (!ev?.lineup_allow_switch) throw new Error("Switching is disabled");
    if (lockedNow(ev.starts_at, ev.lineup_lock_minutes_before)) throw new Error("Lineup is locked");

    await admin
      .from("group_event_lineup_slots")
      .update({
        status: from.status,
        claimed_by: userId,
        claimed_at: new Date().toISOString(),
        stage_name: from.stage_name,
        act_type: from.act_type,
        link_url: from.link_url,
        notes_to_host: from.notes_to_host,
      })
      .eq("id", to.id);
    await admin
      .from("group_event_lineup_slots")
      .update({
        status: "open",
        claimed_by: null,
        claimed_at: null,
        stage_name: null,
        act_type: null,
        link_url: null,
        notes_to_host: null,
      })
      .eq("id", from.id);

    await admin.from("group_event_lineup_audit").insert({
      event_id: from.event_id,
      slot_id: to.id,
      actor_user_id: userId,
      action: "switch",
      metadata: { from_slot: from.id, to_slot: to.id },
    });
    return { ok: true };
  });

export const updateMyPerformerInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ slot_id: z.string().uuid(), performer: performerSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const admin = await getAdmin();
    const { data: slot } = await admin
      .from("group_event_lineup_slots")
      .select("id,event_id,claimed_by")
      .eq("id", data.slot_id)
      .maybeSingle();
    if (!slot || slot.claimed_by !== userId) throw new Error("Not your slot");
    const performer = cleanPerformer(data.performer);
    await admin.from("group_event_lineup_slots").update(performer).eq("id", slot.id);
    await admin.from("group_event_lineup_audit").insert({
      event_id: slot.event_id,
      slot_id: slot.id,
      actor_user_id: userId,
      action: "edit",
      metadata: { performer },
    });
    return { ok: true };
  });

// ---- Soft hold (guest, no auth) ----

export const softHoldSlot = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        slot_id: z.string().uuid(),
        email: z.string().trim().toLowerCase().email().max(200),
        performer: performerSchema,
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const admin = await getAdmin();

    const { data: slot } = await admin
      .from("group_event_lineup_slots")
      .select("id,event_id,status,hold_expires_at")
      .eq("id", data.slot_id)
      .maybeSingle();
    if (!slot) throw new Error("Slot not found");

    const isExpired =
      slot.status === "soft_hold" &&
      slot.hold_expires_at &&
      new Date(slot.hold_expires_at).getTime() < Date.now();
    if (slot.status !== "open" && !isExpired) throw new Error("This spot is no longer available.");

    const { data: ev } = await admin
      .from("group_events")
      .select("kind,starts_at,lineup_lock_minutes_before")
      .eq("id", slot.event_id)
      .maybeSingle();
    if (!ev || ev.kind !== "lineup") throw new Error("Not a lineup event");
    if (lockedNow(ev.starts_at, ev.lineup_lock_minutes_before)) throw new Error("Lineup is locked.");

    // Rate limit: one active hold per email per event
    const { data: dupes } = await admin
      .from("group_event_lineup_slots")
      .select("id")
      .eq("event_id", slot.event_id)
      .eq("hold_email", data.email)
      .eq("status", "soft_hold")
      .gt("hold_expires_at", new Date().toISOString());
    if ((dupes ?? []).length > 0) throw new Error("You already have a pending spot — finish signup or wait 5 minutes.");

    const performer = cleanPerformer(data.performer);
    const expires = new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString();
    const { error } = await admin
      .from("group_event_lineup_slots")
      .update({
        status: "soft_hold",
        hold_email: data.email,
        hold_expires_at: expires,
        ...performer,
      })
      .eq("id", slot.id);
    if (error) throw new Error(error.message);

    await admin.from("group_event_lineup_audit").insert({
      event_id: slot.event_id,
      slot_id: slot.id,
      actor_email: data.email,
      action: "hold",
      metadata: { performer, expires_at: expires },
    });
    return { ok: true, expires_at: expires };
  });

// Called from client after successful signup to convert soft holds to a real claim.
export const convertMyHolds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const admin = await getAdmin();

    const { data: u } = await supabase.auth.getUser();
    const email = u.user?.email?.toLowerCase();
    if (!email) return { converted: 0 };

    const { data: holds } = await admin
      .from("group_event_lineup_slots")
      .select("id,event_id")
      .eq("hold_email", email)
      .eq("status", "soft_hold")
      .gt("hold_expires_at", new Date().toISOString());

    let converted = 0;
    for (const h of holds ?? []) {
      const { data: ev } = await admin
        .from("group_events")
        .select("lineup_mode")
        .eq("id", h.event_id)
        .maybeSingle();
      const newStatus = ev?.lineup_mode === "host_approval" ? "requested" : "confirmed";
      const { error } = await admin
        .from("group_event_lineup_slots")
        .update({
          status: newStatus,
          claimed_by: userId,
          claimed_at: new Date().toISOString(),
          hold_email: null,
          hold_expires_at: null,
        })
        .eq("id", h.id);
      if (!error) {
        converted++;
        await admin.from("group_event_lineup_audit").insert({
          event_id: h.event_id,
          slot_id: h.id,
          actor_user_id: userId,
          actor_email: email,
          action: "convert_hold",
        });
      }
    }
    return { converted };
  });

// ---- Host / admin actions ----

const hostAction = z.object({ event_id: z.string().uuid(), slot_id: z.string().uuid() });

async function ensureHost(context: { supabase: ReturnType<typeof publicClient>; userId: string }, eventId: string) {
  if (!(await isHostOrAdmin(context.supabase, context.userId, eventId))) throw new Error("Host only");
}

export const approveClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => hostAction.parse(i))
  .handler(async ({ data, context }) => {
    await ensureHost(context, data.event_id);
    const admin = await getAdmin();
    await admin.from("group_event_lineup_slots").update({ status: "confirmed" }).eq("id", data.slot_id).eq("event_id", data.event_id);
    await admin.from("group_event_lineup_audit").insert({
      event_id: data.event_id,
      slot_id: data.slot_id,
      actor_user_id: context.userId,
      action: "approve",
    });
    return { ok: true };
  });

export const declineClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => hostAction.parse(i))
  .handler(async ({ data, context }) => {
    await ensureHost(context, data.event_id);
    const admin = await getAdmin();
    await admin
      .from("group_event_lineup_slots")
      .update({
        status: "open",
        claimed_by: null,
        claimed_at: null,
        stage_name: null,
        act_type: null,
        link_url: null,
        notes_to_host: null,
      })
      .eq("id", data.slot_id)
      .eq("event_id", data.event_id);
    await admin.from("group_event_lineup_audit").insert({
      event_id: data.event_id,
      slot_id: data.slot_id,
      actor_user_id: context.userId,
      action: "decline",
    });
    return { ok: true };
  });

export const removeFromSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => hostAction.parse(i))
  .handler(async ({ data, context }) => {
    await ensureHost(context, data.event_id);
    const admin = await getAdmin();
    await admin
      .from("group_event_lineup_slots")
      .update({
        status: "open",
        claimed_by: null,
        claimed_at: null,
        manual_performer_name: null,
        stage_name: null,
        act_type: null,
        link_url: null,
        notes_to_host: null,
        hold_email: null,
        hold_expires_at: null,
      })
      .eq("id", data.slot_id)
      .eq("event_id", data.event_id);
    await admin.from("group_event_lineup_audit").insert({
      event_id: data.event_id,
      slot_id: data.slot_id,
      actor_user_id: context.userId,
      action: "manual_remove",
    });
    return { ok: true };
  });

export const addManualPerformer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      event_id: z.string().uuid(),
      slot_id: z.string().uuid(),
      name: z.string().trim().min(1).max(80),
      link_url: z.string().trim().url().max(300).optional().or(z.literal("")),
      act_type: z.enum(["comedian", "band", "dj", "other"]).optional(),
      notes_to_host: z.string().trim().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureHost(context, data.event_id);
    const admin = await getAdmin();
    await admin
      .from("group_event_lineup_slots")
      .update({
        status: "confirmed",
        manual_performer_name: data.name,
        stage_name: data.name,
        act_type: data.act_type ?? null,
        link_url: data.link_url || null,
        notes_to_host: data.notes_to_host ?? null,
      })
      .eq("id", data.slot_id)
      .eq("event_id", data.event_id);
    await admin.from("group_event_lineup_audit").insert({
      event_id: data.event_id,
      slot_id: data.slot_id,
      actor_user_id: context.userId,
      action: "manual_add",
      metadata: { name: data.name },
    });
    return { ok: true };
  });

// Initialize slots for a lineup event (idempotent: only fills missing positions up to N).
export const initLineupSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid(), count: z.number().int().min(1).max(50) }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureHost(context, data.event_id);
    const admin = await getAdmin();
    const { data: existing } = await admin
      .from("group_event_lineup_slots")
      .select("position")
      .eq("event_id", data.event_id);
    const have = new Set((existing ?? []).map((r) => r.position));
    const toInsert = [];
    for (let i = 1; i <= data.count; i++) {
      if (!have.has(i)) toInsert.push({ event_id: data.event_id, position: i });
    }
    if (toInsert.length) await admin.from("group_event_lineup_slots").insert(toInsert);
    return { created: toInsert.length };
  });

// Audit feed for admin/host
export const listLineupAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureHost(context, data.event_id);
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("group_event_lineup_audit")
      .select("id,slot_id,actor_user_id,actor_email,action,metadata,created_at")
      .eq("event_id", data.event_id)
      .order("created_at", { ascending: false })
      .limit(500);
    return rows ?? [];
  });

// Admin overview: list all lineup events
export const adminListLineupEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admin only");
    const { data } = await supabase
      .from("group_events")
      .select("id,slug,title,starts_at,status,lineup_mode,group:groups!inner(slug,name)")
      .eq("kind", "lineup")
      .is("deleted_at", null)
      .order("starts_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });
