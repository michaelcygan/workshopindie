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
      .select("id,slug,status,mode,category,title,starts_at,auto_converted_at,host_user_id")
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
            payload: { title: ws.title, slug: ws.slug, auto_converted: true },
          })),
        )
        .then(() => null, () => null);
    }
    return { converted: true };
  });

/**
 * Create-a-Collab from a live room (`/lounge/$id`).
 *
 * - Caller must be the room's host OR currently present in the room (instant_presence).
 * - Forks the live room into a persistent Workshop + paired Collab post.
 * - Stamps `instant_rooms.promoted_at` so the room stops being ephemeral and the
 *   in-room banner switches into "Promoted" mode.
 * - Sends opt-in `workshop_join_invites` to everyone else currently in the room.
 * - The initiator becomes host + confirmed participant of the persistent Workshop.
 * - Returns the new workshop slug + collab slug.
 */
export const createCollabFromRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      roomId: z.string().uuid(),
      title: z.string().trim().min(1).max(120),
      pitch: z.string().trim().max(2000).optional(),
      license: z.enum(["cc_by", "rights_managed_externally", "portfolio_credit_only", "private"]).optional(),
      licenseCustom: z.string().trim().max(400).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { roomId, title, pitch, license, licenseCustom } = data;
    const licenseLabel =
      license === "rights_managed_externally" ? "Rights managed externally"
      : license === "portfolio_credit_only" ? (licenseCustom?.trim() ? `Credit only — ${licenseCustom.trim()}` : "Credit only")
      : license === "private" ? "Closed circle (private)"
      : "CC BY 4.0";

    // 1. Load the source room.
    const { data: room, error: roomErr } = await supabaseAdmin
      .from("instant_rooms")
      .select("id, title, kind, medium, category, host_user_id, promoted_at, source_workshop_id")
      .eq("id", roomId)
      .maybeSingle();
    if (roomErr) throw new Error(roomErr.message);
    if (!room) throw new Error("Room not found.");

    // Idempotent: if already promoted, just return existing pointers.
    if (room.promoted_at && room.source_workshop_id) {
      const { data: existingWs } = await supabaseAdmin
        .from("workshops")
        .select("id, slug, topic_collab_post_id")
        .eq("id", room.source_workshop_id)
        .maybeSingle();
      if (existingWs) {
        const { data: collab } = await supabaseAdmin
          .from("collab_posts")
          .select("slug")
          .eq("id", existingWs.topic_collab_post_id ?? "00000000-0000-0000-0000-000000000000")
          .maybeSingle();
        return { workshopSlug: existingWs.slug, collabSlug: collab?.slug ?? null, alreadyPromoted: true };
      }
    }

    // 2. Authorize: host OR currently present.
    const isHost = room.host_user_id === userId;
    if (!isHost) {
      const { data: pres } = await supabaseAdmin
        .from("instant_presence")
        .select("user_id")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!pres) throw new Error("You need to be in the room to create a Collab from it.");
    }

    // 3. Create the persistent Workshop.
    const category = (room.category ?? room.medium ?? "coworking") as
      | "film" | "music" | "writing" | "build" | "visual" | "critique" | "business" | "coworking";
    const { data: ws, error: wsErr } = await supabaseAdmin
      .from("workshops")
      .insert({
        title,
        slug: "",
        category,
        host_user_id: userId,
        mode: "instant_spawned",
        status: "active",
        location_type: "online",
        participant_cap: 12,
        prompt: `License: ${licenseLabel}\n\n${pitch || `Forked from a live Workshop: ${room.title}`}`,
        visibility: "public",
        source_instant_room_id: roomId,
      })
      .select("id, slug")
      .single();
    if (wsErr || !ws) throw new Error(wsErr?.message ?? "Couldn't create the Workshop.");

    // 4. Create the paired Collab post.
    const { data: collab, error: collabErr } = await supabaseAdmin
      .from("collab_posts")
      .insert({
        user_id: userId,
        title,
        slug: "",
        category,
        description: pitch || `Forked from a live Workshop: ${room.title}`,
        live_workshop_id: ws.id,
        location_mode: "online",
        status: "open",
      })
      .select("id, slug")
      .single();
    // Non-fatal: workshop can exist without collab if the collab schema rejects.
    if (collabErr) console.error("[createCollabFromRoom] collab insert failed:", collabErr.message);

    // Backlink Workshop → Collab post if created.
    if (collab?.id) {
      await supabaseAdmin
        .from("workshops")
        .update({ topic_collab_post_id: collab.id })
        .eq("id", ws.id);
    }

    // 5. Stamp source room as promoted.
    await supabaseAdmin
      .from("instant_rooms")
      .update({ promoted_at: new Date().toISOString(), source_workshop_id: ws.id })
      .eq("id", roomId);

    // 6. Initiator → confirmed host participant.
    await supabaseAdmin
      .from("workshop_participants")
      .insert({ workshop_id: ws.id, user_id: userId, participant_status: "confirmed" })
      .then(() => null, () => null);

    // 6b. Copy ephemeral tools forward into the persistent Workshop.
    const { data: srcTools } = await supabaseAdmin
      .from("instant_tools")
      .select("id, tool_type, enabled, created_by_user_id, created_at")
      .eq("room_id", roomId);
    for (const st of srcTools ?? []) {
      const { data: newTool } = await (supabaseAdmin
        .from("workshop_tools") as any)
        .insert({
          workshop_id: ws.id,
          tool_type: st.tool_type,
          enabled: st.enabled,
        })
        .select("id")
        .single();
      if (!newTool) continue;
      const { data: srcItems } = await supabaseAdmin
        .from("instant_tool_items")
        .select("title, body, url, created_by_user_id, created_at")
        .eq("tool_id", st.id);
      if (srcItems && srcItems.length > 0) {
        await (supabaseAdmin.from("workshop_tool_items") as any)
          .insert(
            srcItems
              .filter((it) => !!it.created_by_user_id)
              .map((it) => ({
                tool_id: newTool.id,
                created_by_user_id: it.created_by_user_id,
                title: it.title,
                body: it.body,
                url: it.url,
                created_at: it.created_at,
              })),
          )
          .then(() => null, () => null);
      }
    }

    // 6c. Copy ephemeral Docs forward into workshop_docs.
    const { data: srcDocs } = await supabaseAdmin
      .from("instant_docs")
      .select("title, content_md, sort_order, created_by, created_at")
      .eq("room_id", roomId);
    if (srcDocs && srcDocs.length > 0) {
      await (supabaseAdmin.from("workshop_docs") as any)
        .insert(
          srcDocs.map((d) => ({
            workshop_id: ws.id,
            title: d.title,
            content_md: d.content_md,
            sort_order: d.sort_order,
            created_by: d.created_by,
            created_at: d.created_at,
          })),
        )
        .then(() => null, () => null);
    }

    // 6d. Copy ephemeral Drive links forward into workshop_drive_links.
    const { data: srcLinks } = await supabaseAdmin
      .from("instant_drive_links")
      .select("url, provider, title, note, added_by, created_at")
      .eq("room_id", roomId);
    if (srcLinks && srcLinks.length > 0) {
      await (supabaseAdmin.from("workshop_drive_links") as any)
        .insert(
          srcLinks
            .filter((l) => !!l.added_by)
            .map((l) => ({
              workshop_id: ws.id,
              url: l.url,
              provider: l.provider,
              title: l.title,
              note: l.note,
              added_by: l.added_by,
              created_at: l.created_at,
            })),
        )
        .then(() => null, () => null);
    }

    // 6e. Promote any List items into workshop_tasks (instant_tools.tool_type='list').
    const listTools = (srcTools ?? []).filter((st) => st.tool_type === "list");
    for (const lt of listTools) {
      const { data: lItems } = await supabaseAdmin
        .from("instant_tool_items")
        .select("title, body, done, created_by_user_id, created_at")
        .eq("tool_id", lt.id);
      const tasks = (lItems ?? [])
        .filter((it) => !!it.title && !!it.created_by_user_id)
        .map((it, idx) => ({
          workshop_id: ws.id,
          created_by: it.created_by_user_id,
          title: it.title as string,
          body: it.body,
          status: it.done ? "done" : "open",
          completed_at: it.done ? it.created_at : null,
          sort_order: idx,
          created_at: it.created_at,
        }));
      if (tasks.length > 0) {
        await (supabaseAdmin.from("workshop_tasks") as any).insert(tasks).then(() => null, () => null);
      }
    }

    // 6f. Copy board items forward (instant_board_items -> workshop_board_items).
    // Note: image content URLs that point to the ephemeral 'instant-whiteboard' bucket
    // stay as-is — they remain reachable after promotion since that bucket is public.
    const { data: srcBoardItems } = await supabaseAdmin
      .from("instant_board_items")
      .select("user_id, kind, content, x, y, w, h, z, rotation, created_at")
      .eq("room_id", roomId);
    if (srcBoardItems && srcBoardItems.length > 0) {
      await ((supabaseAdmin as any).from("workshop_board_items") as any)
        .insert(
          srcBoardItems
            .filter((b) => !!b.user_id)
            .map((b) => ({
              workshop_id: ws.id,
              user_id: b.user_id,
              kind: b.kind,
              content: b.content,
              x: b.x,
              y: b.y,
              w: b.w,
              h: b.h,
              z: b.z,
              rotation: b.rotation,
              created_at: b.created_at,
            })),
        )
        .then(() => null, () => null);
    }






    // 7. Opt-in invites for everyone else currently present.
    const { data: presentList } = await supabaseAdmin
      .from("instant_presence")
      .select("user_id")
      .eq("room_id", roomId);
    const inviteeIds = Array.from(new Set(
      (presentList ?? []).map((p) => p.user_id).filter((id): id is string => !!id && id !== userId),
    ));
    if (inviteeIds.length > 0) {
      await supabaseAdmin
        .from("workshop_join_invites")
        .insert(
          inviteeIds.map((uid) => ({
            workshop_id: ws.id,
            invitee_user_id: uid,
            inviter_user_id: userId,
            source_room_id: roomId,
            status: "pending",
          })),
        )
        .then(() => null, () => null);

      await supabaseAdmin
        .from("notifications")
        .insert(
          inviteeIds.map((uid) => ({
            user_id: uid,
            kind: "workshop_invite_from_room",
            actor_user_id: userId,
            entity_type: "workshop",
            entity_id: ws.id,
            payload: { workshop_slug: ws.slug, title, room_id: roomId },
          })),
        )
        .then(() => null, () => null);
    }

    return { workshopSlug: ws.slug, collabSlug: collab?.slug ?? null, alreadyPromoted: false };
  });

/** Accept a pending workshop_join_invite — adds the user as a confirmed participant. */
export const acceptWorkshopJoinInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workshopId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: invite } = await supabaseAdmin
      .from("workshop_join_invites")
      .select("id, status")
      .eq("workshop_id", data.workshopId)
      .eq("invitee_user_id", userId)
      .maybeSingle();
    if (!invite) throw new Error("No invite found.");
    if (invite.status === "accepted") {
      const { data: ws } = await supabaseAdmin.from("workshops").select("slug").eq("id", data.workshopId).maybeSingle();
      return { workshopSlug: ws?.slug ?? null };
    }
    await supabaseAdmin
      .from("workshop_join_invites")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", invite.id);
    await supabaseAdmin
      .from("workshop_participants")
      .insert({ workshop_id: data.workshopId, user_id: userId, participant_status: "confirmed" })
      .then(() => null, () => null);
    const { data: ws } = await supabaseAdmin.from("workshops").select("slug").eq("id", data.workshopId).maybeSingle();
    return { workshopSlug: ws?.slug ?? null };
  });

export const declineWorkshopJoinInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workshopId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await supabaseAdmin
      .from("workshop_join_invites")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("workshop_id", data.workshopId)
      .eq("invitee_user_id", context.userId);
    return { ok: true };
  });
