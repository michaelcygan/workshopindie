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
    const { data: post, error: postErr } = await supabaseAdmin
      .from("collab_posts")
      .select("id,title,user_id,category,live_workshop_id")
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
        location_type: "online",
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
