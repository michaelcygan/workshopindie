/**
 * Server functions backing the multi-user Recorder "Personas" tabs.
 *
 * Personas are per-room (instant or workshop) collaboration units inside the
 * Recorder. A persona owner invites room members; everyone records their own
 * local sources in sync, then collaborators mirror their take files into the
 * owner's drive so the producer has a complete picked-up take.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const scopeShape = z.union([
  z.object({ kind: z.literal("instant"), roomId: z.string().uuid() }),
  z.object({ kind: z.literal("workshop"), workshopId: z.string().uuid() }),
]);

/** Verify the caller is a member of the given room/workshop. */
async function assertScopeMember(
  supabase: any,
  scope: z.infer<typeof scopeShape>,
  userId: string,
): Promise<void> {
  if (scope.kind === "instant") {
    const { data, error } = await supabase.rpc("is_room_member", {
      _room_id: scope.roomId,
      _user_id: userId,
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Not a member of this room");
  } else {
    const { data, error } = await supabase.rpc("is_workshop_member", {
      _workshop_id: scope.workshopId,
      _user_id: userId,
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Not a member of this workshop");
  }
}

export const createPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        scope: scopeShape,
        name: z.string().min(1).max(60),
        controlMode: z.enum(["owner_start", "self"]).default("owner_start"),
        privacy: z.enum(["shared", "private"]).default("shared"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertScopeMember(supabase, data.scope, userId);
    const payload: Record<string, unknown> = {
      owner_user_id: userId,
      name: data.name.trim(),
      control_mode: data.controlMode,
      privacy: data.privacy,
    };
    if (data.scope.kind === "instant") payload.room_id = data.scope.roomId;
    else payload.workshop_id = data.scope.workshopId;
    const { data: row, error } = await supabase
      .from("recorder_personas")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // Owner is implicit but also store as a member row for simpler member queries.
    await supabase
      .from("recorder_persona_members")
      .insert({ persona_id: row.id, user_id: userId, state: "ready" });
    return { id: row.id as string };
  });

export const invitePersonaMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ personaId: z.string().uuid(), userId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: persona, error: pErr } = await supabase
      .from("recorder_personas")
      .select("id,owner_user_id,room_id,workshop_id")
      .eq("id", data.personaId)
      .maybeSingle();
    if (pErr || !persona) throw new Error(pErr?.message ?? "Persona not found");
    if (persona.owner_user_id !== userId) throw new Error("Only the owner can invite");
    // Confirm invitee is part of the room/workshop.
    if (persona.room_id) {
      const { data: ok } = await supabase.rpc("is_room_member", { _room_id: persona.room_id, _user_id: data.userId });
      if (!ok) throw new Error("That user isn't in this room");
    } else if (persona.workshop_id) {
      const { data: ok } = await supabase.rpc("is_workshop_member", { _workshop_id: persona.workshop_id, _user_id: data.userId });
      if (!ok) throw new Error("That user isn't in this workshop");
    }
    const { error } = await supabase
      .from("recorder_persona_members")
      .upsert({ persona_id: data.personaId, user_id: data.userId, state: "invited" }, { onConflict: "persona_id,user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPersonaMemberState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        personaId: z.string().uuid(),
        state: z.enum(["invited", "ready", "recording", "declined", "left"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("recorder_persona_members")
      .upsert(
        { persona_id: data.personaId, user_id: userId, state: data.state },
        { onConflict: "persona_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ personaId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("recorder_personas")
      .delete()
      .eq("id", data.personaId)
      .eq("owner_user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Mirror a single drive file from a collaborator into the persona owner's
 * drive. The mirrored row points at the same storage_path; signed URLs work
 * because the owner is a member of the same room/workshop, and storage
 * policies allow reads for room members.
 */
export const mirrorPersonaTakeFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        personaId: z.string().uuid(),
        sourceFileId: z.string().uuid(),
        takeId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: persona, error: pErr } = await supabase
      .from("recorder_personas")
      .select("id,owner_user_id,room_id,workshop_id,privacy")
      .eq("id", data.personaId)
      .maybeSingle();
    if (pErr || !persona) throw new Error(pErr?.message ?? "Persona not found");
    if (persona.privacy === "private") return { ok: true, skipped: true };
    if (persona.owner_user_id === userId) return { ok: true, skipped: true };

    // Caller must be a persona member.
    const { data: memberRow } = await supabase
      .from("recorder_persona_members")
      .select("user_id")
      .eq("persona_id", data.personaId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!memberRow) throw new Error("You aren't a member of that persona");

    const table = persona.room_id ? "instant_drive_files" : "workshop_drive_files";
    const { data: src, error: sErr } = await supabase
      .from(table)
      .select("storage_path,filename,mime_type,byte_size,duration_ms,note")
      .eq("id", data.sourceFileId)
      .eq("uploader_id", userId)
      .maybeSingle();
    if (sErr || !src) throw new Error(sErr?.message ?? "File not found");

    // Use admin client to insert as the persona owner, since RLS requires uploader_id = auth.uid().
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mirror: Record<string, unknown> = {
      uploader_id: persona.owner_user_id,
      storage_path: src.storage_path,
      filename: src.filename,
      mime_type: src.mime_type,
      byte_size: src.byte_size,
      duration_ms: src.duration_ms,
      note: `${src.note ?? "Take"} · from collaborator`,
      take_id: data.takeId,
      persona_id: data.personaId,
      linked_take_owner_user_id: persona.owner_user_id,
    };
    if (persona.room_id) mirror.room_id = persona.room_id;
    else mirror.workshop_id = persona.workshop_id;
    const { error: iErr } = await supabaseAdmin.from(table).insert(mirror);
    if (iErr) throw new Error(iErr.message);
    return { ok: true };
  });
