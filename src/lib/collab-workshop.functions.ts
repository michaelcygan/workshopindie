import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Owner one-taps "Open a Workshop on this" from a Collab detail page.
 * - Creates (or returns the existing) live Workshop tied to the Collab as its topic.
 * - Auto-creates the paired room (instant_rooms, kind='workshop').
 * - Marks the host as a confirmed participant so they can enter the room.
 * - Notifies confirmed applicants (people who contacted as logged-in users).
 * Idempotent: if a live workshop already exists for the post, returns it.
 */
export const openWorkshopOnCollab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ collabPostId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { collabPostId } = data;

    // 1. Verify caller owns the collab post.
    // NOTE: Only the Collab owner can open a Workshop on this post, and the owner
    // is always the Workshop host (host_user_id = userId below). Do not relax.
    const { data: post, error: postErr } = await supabaseAdmin
      .from("collab_posts")
      .select("id,title,user_id,category,live_workshop_id,location_mode,city_id,also_cities")
      .eq("id", collabPostId)
      .maybeSingle();
    if (postErr) throw new Error(postErr.message);
    if (!post) throw new Error("Collab not found.");
    if (post.user_id !== userId) throw new Error("Only the collab owner can open a Workshop.");

    // 2. If an active linked workshop already exists, reuse it.
    if (post.live_workshop_id) {
      const { data: existingWs } = await supabaseAdmin
        .from("workshops")
        .select("id,slug,status")
        .eq("id", post.live_workshop_id)
        .maybeSingle();
      if (existingWs && existingWs.status !== "archived" && existingWs.status !== "canceled") {
        const { data: existingRoom } = await supabaseAdmin
          .from("instant_rooms")
          .select("id")
          .eq("workshop_id", existingWs.id)
          .maybeSingle();
        if (existingRoom?.id) {
          return { workshopId: existingWs.id, roomId: existingRoom.id, slug: existingWs.slug };
        }
      }
    }

    // City-scope: if the Collab is in_person with a city, restrict the Workshop's
    // discovery audience to that city (+ any "also open to" cities).
    const isInPerson = post.location_mode === "in_person" && !!post.city_id;
    const audienceCityIds = isInPerson
      ? Array.from(new Set<string>([post.city_id as string, ...((post.also_cities as string[] | null) ?? [])]))
      : [];

    // 3. Create the live Workshop. The DB trigger will fill in `slug`.
    const now = new Date();
    const endsAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2h default
    const { data: ws, error: wsErr } = await supabaseAdmin
      .from("workshops")
      .insert({
        title: post.title,
        slug: "",
        category: post.category,
        host_user_id: userId,
        mode: "instant_spawned",
        status: "active",
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        location_type: isInPerson ? "in_person" : "online",
        city_id: isInPerson ? post.city_id : null,
        audience_city_ids: audienceCityIds,
        participant_cap: 5,
        topic_collab_post_id: post.id,
        prompt: `Live working session on Collab: ${post.title}`,
        visibility: "public",
      })
      .select("id,slug")
      .single();
    if (wsErr || !ws) throw new Error(wsErr?.message ?? "Couldn't open the Workshop.");

    // 4. Link the Collab back.
    await supabaseAdmin
      .from("collab_posts")
      .update({ live_workshop_id: ws.id })
      .eq("id", post.id);

    // 5. Ensure host is a confirmed participant (so RLS lets them into the room).
    await supabaseAdmin
      .from("workshop_participants")
      .insert({
        workshop_id: ws.id,
        user_id: userId,
        participant_status: "confirmed",
      })
      .then(() => null, () => null); // ignore duplicates if trigger already did it

    // 6. Pair a workshop room.
    const { data: room, error: roomErr } = await supabaseAdmin
      .from("instant_rooms")
      .insert({
        kind: "workshop",
        title: post.title,
        status: "active",
        participant_cap: 5,
        creator_id: userId,
        category: post.category,
        workshop_id: ws.id,
      })
      .select("id")
      .single();
    if (roomErr || !room) throw new Error(roomErr?.message ?? "Couldn't open the room.");

    // 7. Notify confirmed applicants — anyone who sent a contact event on this Collab.
    const { data: contacts } = await supabaseAdmin
      .from("collab_contact_events")
      .select("sender_user_id")
      .eq("collab_post_id", post.id);
    const senderIds = Array.from(
      new Set((contacts ?? []).map((c) => c.sender_user_id).filter((id): id is string => !!id && id !== userId)),
    );
    if (senderIds.length > 0) {
      await supabaseAdmin
        .from("notifications")
        .insert(
          senderIds.map((uid) => ({
            user_id: uid,
            kind: "collab_workshop_live",
            actor_user_id: userId,
            entity_type: "workshop",
            entity_id: ws.id,
            payload: {
              collab_post_id: post.id,
              workshop_slug: ws.slug,
              title: post.title,
            },
          })),
        )
        .then(() => null, () => null);
    }

    return { workshopId: ws.id, roomId: room.id, slug: ws.slug };
  });

/**
 * RSVP to a scheduled Workshop — one-tap. Creates a confirmed participant row.
 * Idempotent: returns silently if already RSVP'd.
 */
export const rsvpToWorkshop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workshopId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: ws } = await supabaseAdmin
      .from("workshops")
      .select("id,status,participant_cap,confirmed_count")
      .eq("id", data.workshopId)
      .maybeSingle();
    if (!ws) throw new Error("Workshop not found.");
    if (ws.status === "archived" || ws.status === "canceled") throw new Error("This Workshop is closed.");
    if (ws.participant_cap && ws.confirmed_count >= ws.participant_cap) {
      throw new Error("This Workshop is full.");
    }
    const { error } = await supabaseAdmin
      .from("workshop_participants")
      .insert({ workshop_id: data.workshopId, user_id: userId, participant_status: "confirmed" });
    if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });

export const cancelRsvp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workshopId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await supabaseAdmin
      .from("workshop_participants")
      .delete()
      .eq("workshop_id", data.workshopId)
      .eq("user_id", context.userId);
    return { ok: true };
  });

/**
 * Convert an unattended scheduled Workshop into a live drop-in lounge of the
 * same medium. Idempotent. Called by pg_cron sweep and safe to call on demand.
 * Rules: must be past starts_at + 15min, no participants ever checked in.
 */
export const convertScheduledToLive = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ workshopId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: ws } = await supabaseAdmin
      .from("workshops")
      .select("id,status,mode,category,title,starts_at,auto_converted_at,host_user_id")
      .eq("id", data.workshopId)
      .maybeSingle();
    if (!ws) return { converted: false, reason: "not_found" };
    if (ws.auto_converted_at) return { converted: false, reason: "already_converted" };
    if (ws.mode !== "scheduled") return { converted: false, reason: "wrong_mode" };
    if (!ws.starts_at) return { converted: false, reason: "no_start_time" };
    const startedAgoMs = Date.now() - new Date(ws.starts_at).getTime();
    if (startedAgoMs < 15 * 60 * 1000) return { converted: false, reason: "too_early" };

    // Check if anyone actually showed up via paired room presence.
    const { data: room } = await supabaseAdmin
      .from("instant_rooms")
      .select("id")
      .eq("workshop_id", ws.id)
      .maybeSingle();
    if (room) {
      const { count } = await supabaseAdmin
        .from("instant_presence")
        .select("user_id", { count: "exact", head: true })
        .eq("room_id", room.id);
      if ((count ?? 0) > 0) return { converted: false, reason: "people_present" };
    }

    // Flip to a live spawned room of the same medium.
    await supabaseAdmin
      .from("workshops")
      .update({
        mode: "instant_spawned",
        status: "active",
        auto_converted_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", ws.id);

    if (!room) {
      await supabaseAdmin.from("instant_rooms").insert({
        kind: "workshop",
        title: ws.title,
        status: "active",
        participant_cap: 5,
        creator_id: ws.host_user_id,
        category: ws.category,
        workshop_id: ws.id,
      });
    }

    // Notify everyone who RSVP'd + the host.
    const { data: rsvps } = await supabaseAdmin
      .from("workshop_participants")
      .select("user_id")
      .eq("workshop_id", ws.id);
    const recipients = Array.from(new Set((rsvps ?? []).map((r) => r.user_id)));
    if (recipients.length > 0) {
      await supabaseAdmin
        .from("notifications")
        .insert(
          recipients.map((uid) => ({
            user_id: uid,
            kind: uid === ws.host_user_id ? "workshop_ran_without_you" : "workshop_now_live",
            entity_type: "workshop",
            entity_id: ws.id,
            payload: { title: ws.title, auto_converted: true },
          })),
        )
        .then(() => null, () => null);
    }
    return { converted: true };
  });
