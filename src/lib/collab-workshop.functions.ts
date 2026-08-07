import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rpcOutcomeError } from "@/lib/errors";
import { withOpLog } from "@/lib/obs/log";
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
  .inputValidator((input) => z.object({ collabPostId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { collabPostId } = data;

    // Everything that must hold together — Workshop, backlink, host seat and
    // paired room — happens inside one Postgres transaction. Repeat taps
    // return the same Workshop instead of forking a second one.
    const { data: rows, error } = await supabase.rpc("open_workshop_on_collab", {
      _collab_post_id: collabPostId,
    } as never);
    if (error) throw new Error(error.message);
    const result = (Array.isArray(rows) ? rows[0] : rows) as
      | {
          outcome: string;
          workshop_id: string | null;
          workshop_slug: string | null;
          room_id: string | null;
          created: boolean;
        }
      | undefined;
    if (!result) throw new Error("Couldn't open the Workshop.");
    if (result.outcome === "not_found") throw new Error("Collab not found.");
    if (result.outcome === "forbidden") {
      throw new Error("Only the collab owner can open a Workshop.");
    }

    const ws = { id: result.workshop_id as string, slug: result.workshop_slug as string };
    const roomId = result.room_id as string;

    // Notify people who reached out on this Collab — best-effort, and only the
    // first time the Workshop actually opens.
    if (result.created) {
      const [{ data: contacts }, { data: post }] = await Promise.all([
        supabaseAdmin
          .from("collab_contact_events")
          .select("sender_user_id")
          .eq("collab_post_id", collabPostId),
        supabaseAdmin.from("collab_posts").select("title").eq("id", collabPostId).maybeSingle(),
      ]);
      const senderIds = Array.from(
        new Set(
          (contacts ?? [])
            .map((c) => c.sender_user_id)
            .filter((id): id is string => !!id && id !== userId),
        ),
      );
      if (senderIds.length > 0) {
        const { notifyMany } = await import("@/lib/notifications/deliver.server");
        await notifyMany({
          recipientIds: senderIds,
          actorUserId: userId,
          kind: "collab_workshop_live",
          entityType: "workshop",
          entityId: ws.id,
          preference: "inapp_collab_activity",
          payload: {
            collab_post_id: collabPostId,
            workshop_slug: ws.slug,
            title: post?.title ?? "",
          },
        });
      }
    }

    return { workshopId: ws.id, roomId, slug: ws.slug };
  });

/**
 * RSVP to a scheduled Workshop — one-tap. Creates a confirmed participant row.
 * Idempotent: returns silently if already RSVP'd.
 */
export const rsvpToWorkshop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workshopId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) =>
    withOpLog(
      "workshop.seat.reserve",
      { entity: "workshop", entityId: data.workshopId, authed: true },
      async () => {
        // Seat reservation happens under a row lock in Postgres, so the cap holds
        // even when several people tap RSVP in the same second.
        const { data: outcome, error } = await context.supabase.rpc("reserve_workshop_seat", {
          _workshop_id: data.workshopId,
        } as never);
        if (error) throw new Error(error.message);
        const status = String(outcome);
        switch (status) {
          case "joined":
          case "already_joined":
            return { ok: true };
          case "full":
            throw rpcOutcomeError(status, "This Workshop is full.");
          case "closed":
            throw rpcOutcomeError(status, "This Workshop is closed.");
          case "not_found":
            throw rpcOutcomeError(status, "Workshop not found.");
          default:
            throw rpcOutcomeError(status, "You can't join this Workshop.");
        }
      },
    ),
  );

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

// NOTE: The `convertScheduledToLive` server function was removed as it was an
// unauthenticated endpoint that duplicated logic already implemented safely
// inline in the cron-secret-gated `/api/public/workshops/sweep` route.

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
    z
      .object({
        roomId: z.string().uuid(),
        title: z.string().trim().min(1).max(120),
        pitch: z.string().trim().max(2000).optional(),
        license: z
          .enum(["cc_by", "rights_managed_externally", "portfolio_credit_only", "private"])
          .optional(),
        licenseCustom: z.string().trim().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { roomId, title, pitch, license, licenseCustom } = data;
    const licenseLabel =
      license === "rights_managed_externally"
        ? "Rights managed externally"
        : license === "portfolio_credit_only"
          ? licenseCustom?.trim()
            ? `Credit only — ${licenseCustom.trim()}`
            : "Credit only"
          : license === "private"
            ? "Closed circle (private)"
            : "CC BY 4.0";

    // Same community-standards check every other written surface runs.
    const { moderateFields } = await import("@/lib/moderation/service.server");
    await moderateFields(userId, "collab.from_room", { title, pitch: pitch ?? null });

    // Workshop + paired Collab + backlink + promotion stamp + host seat all
    // land together, or none of them do.
    const { data: rows, error } = await supabase.rpc("promote_room_to_collab", {
      _room_id: roomId,
      _title: title,
      _pitch: pitch ?? null,
      _license_label: licenseLabel,
    } as never);
    if (error) throw new Error(error.message);
    const result = (Array.isArray(rows) ? rows[0] : rows) as
      | {
          outcome: string;
          workshop_id: string | null;
          workshop_slug: string | null;
          collab_slug: string | null;
          created: boolean;
        }
      | undefined;
    if (!result) throw new Error("Couldn't create the Workshop.");
    if (result.outcome === "not_found") throw new Error("Room not found.");
    if (result.outcome === "forbidden") {
      throw new Error("You need to be in the room to create a Collab from it.");
    }
    if (!result.created) {
      return {
        workshopSlug: result.workshop_slug,
        collabSlug: result.collab_slug,
        alreadyPromoted: true,
      };
    }

    const ws = { id: result.workshop_id as string, slug: result.workshop_slug as string };
    const collab = { slug: result.collab_slug };

    // 6b. Copy ephemeral tools forward into the persistent Workshop.
    const { data: srcTools } = await supabaseAdmin
      .from("instant_tools")
      .select("id, tool_type, enabled, created_by_user_id, created_at")
      .eq("room_id", roomId);
    for (const st of srcTools ?? []) {
      const { data: newTool } = await (supabaseAdmin.from("workshop_tools") as any)
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
          .then(
            () => null,
            () => null,
          );
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
        .then(
          () => null,
          () => null,
        );
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
        .then(
          () => null,
          () => null,
        );
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
        await (supabaseAdmin.from("workshop_tasks") as any).insert(tasks).then(
          () => null,
          () => null,
        );
      }
    }

    // 7. Opt-in invites for everyone else currently present.
    const { data: presentList } = await supabaseAdmin
      .from("instant_presence")
      .select("user_id")
      .eq("room_id", roomId);
    const inviteeIds = Array.from(
      new Set(
        (presentList ?? [])
          .map((p) => p.user_id)
          .filter((id): id is string => !!id && id !== userId),
      ),
    );
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
        .then(
          () => null,
          () => null,
        );

      const { notifyMany } = await import("@/lib/notifications/deliver.server");
      await notifyMany({
        recipientIds: inviteeIds,
        actorUserId: userId,
        kind: "workshop_invite_from_room",
        entityType: "workshop",
        entityId: ws.id,
        preference: "inapp_workshop_updates",
        payload: { workshop_slug: ws.slug, title, room_id: roomId },
      });
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
      const { data: ws } = await supabaseAdmin
        .from("workshops")
        .select("slug")
        .eq("id", data.workshopId)
        .maybeSingle();
      return { workshopSlug: ws?.slug ?? null };
    }
    await supabaseAdmin
      .from("workshop_join_invites")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", invite.id);
    await supabaseAdmin
      .from("workshop_participants")
      .insert({ workshop_id: data.workshopId, user_id: userId, participant_status: "confirmed" })
      .then(
        () => null,
        () => null,
      );
    const { data: ws } = await supabaseAdmin
      .from("workshops")
      .select("slug")
      .eq("id", data.workshopId)
      .maybeSingle();
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
