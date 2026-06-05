import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Workshop sweep, called by pg_cron every minute. Two passes:
 *
 *  1. "Starting soon" — for any scheduled workshop whose starts_at is within
 *     the next 5 minutes and hasn't notified yet, fire a `workshop_starting`
 *     notification to every confirmed RSVP (incl. host). Stamps
 *     `starting_notified_at` so we only fire once per workshop.
 *
 *  2. "No-show convert" — for scheduled workshops past starts_at+15min with
 *     nobody present, flip to a live spawned room of the same medium and
 *     notify all RSVPs that it ran without them.
 */
export const Route = createFileRoute("/api/public/workshops/sweep")({
  server: {
    handlers: {
      POST: async () => {
        const startingResults = await runStartingPass();
        const sweepResults = await runNoShowPass();
        const retentionResults = await runRetentionPass();
        return Response.json({
          ok: true,
          starting: startingResults,
          sweep: sweepResults,
          retention: retentionResults,
        });
      },
    },
  },
});

async function runStartingPass() {
  const now = new Date();
  const windowAhead = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("workshops")
    .select("id,slug,title,starts_at,host_user_id")
    .eq("mode", "scheduled")
    .is("starting_notified_at", null)
    .in("status", ["open", "check_in"])
    .gte("starts_at", nowIso)
    .lte("starts_at", windowAhead)
    .limit(50);

  if (error || !rows) return { fired: 0, error: error?.message };

  const fired: string[] = [];
  for (const ws of rows) {
    const { data: rsvps } = await supabaseAdmin
      .from("workshop_participants")
      .select("user_id")
      .eq("workshop_id", ws.id)
      .in("participant_status", ["confirmed", "checked_in"]);
    const recipients = Array.from(
      new Set([...(rsvps ?? []).map((r) => r.user_id), ws.host_user_id]),
    ).filter(Boolean) as string[];

    if (recipients.length > 0) {
      await supabaseAdmin
        .from("notifications")
        .insert(
          recipients.map((uid) => ({
            user_id: uid,
            kind: "workshop_starting",
            entity_type: "workshop",
            entity_id: ws.id,
            payload: { title: ws.title, slug: ws.slug, starts_at: ws.starts_at },
          })),
        )
        .then(() => null, () => null);
    }

    await supabaseAdmin
      .from("workshops")
      .update({ starting_notified_at: new Date().toISOString() })
      .eq("id", ws.id);

    fired.push(ws.id);
  }

  return { fired: fired.length, ids: fired };
}

async function runNoShowPass() {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: stale, error } = await supabaseAdmin
    .from("workshops")
    .select("id")
    .eq("mode", "scheduled")
    .is("auto_converted_at", null)
    .lt("starts_at", cutoff)
    .in("status", ["open", "check_in", "active"])
    .limit(50);
  if (error) return { swept: 0, error: error.message };

  const results: { id: string; converted: boolean; reason?: string }[] = [];
  for (const ws of stale ?? []) {
    const { data: full } = await supabaseAdmin
      .from("workshops")
      .select("id,slug,status,mode,category,title,starts_at,auto_converted_at,host_user_id")
      .eq("id", ws.id)
      .maybeSingle();
    if (!full || full.auto_converted_at || full.mode !== "scheduled" || !full.starts_at) {
      results.push({ id: ws.id, converted: false, reason: "skipped" });
      continue;
    }
    const { data: room } = await supabaseAdmin
      .from("instant_rooms")
      .select("id")
      .eq("workshop_id", full.id)
      .maybeSingle();
    if (room) {
      const { count } = await supabaseAdmin
        .from("instant_presence")
        .select("user_id", { count: "exact", head: true })
        .eq("room_id", room.id);
      if ((count ?? 0) > 0) {
        results.push({ id: ws.id, converted: false, reason: "people_present" });
        continue;
      }
    }
    await supabaseAdmin
      .from("workshops")
      .update({
        mode: "instant_spawned",
        status: "active",
        auto_converted_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", full.id);
    if (!room) {
      await supabaseAdmin.from("instant_rooms").insert({
        kind: "workshop",
        title: full.title,
        status: "active",
        participant_cap: 5,
        creator_id: full.host_user_id,
        category: full.category,
        workshop_id: full.id,
      });
    }
    const { data: rsvps } = await supabaseAdmin
      .from("workshop_participants")
      .select("user_id")
      .eq("workshop_id", full.id);
    const recipients = Array.from(new Set((rsvps ?? []).map((r) => r.user_id)));
    if (recipients.length > 0) {
      await supabaseAdmin
        .from("notifications")
        .insert(
          recipients.map((uid) => ({
            user_id: uid,
            kind: uid === full.host_user_id ? "workshop_ran_without_you" : "workshop_now_live",
            entity_type: "workshop",
            entity_id: full.id,
            payload: { title: full.title, slug: full.slug, auto_converted: true },
          })),
        )
        .then(() => null, () => null);
    }
    results.push({ id: ws.id, converted: true });
  }
  return { swept: results.length, results };
}

/**
 * Retention pass — Workshop studios auto-clear after 30 days of inactivity.
 * `last_activity_at` and `archive_at` are maintained by triggers on every
 * studio write. We send heads-ups at 7d, 3d, 24h, and 6h before archive_at,
 * then hard-delete the studio once archive_at passes.
 *
 * If members come back and write something, the trigger resets archive_at
 * AND clears the four notified flags, so the reminder ladder fires again
 * next time the studio goes quiet.
 */
async function runRetentionPass() {
  const now = new Date();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();

  // Order matters: fire shortest window LAST so a workshop crossing multiple
  // thresholds in one sweep still ends with the closest reminder stamped.
  const windows: Array<{
    flag:
      | "archive_notified_7d_at"
      | "archive_notified_3d_at"
      | "archive_notified_24h_at"
      | "archive_notified_6h_at";
    kind: string;
    untilMs: number;
  }> = [
    { flag: "archive_notified_7d_at", kind: "workshop_archive_7d", untilMs: 7 * 24 * 60 * 60 * 1000 },
    { flag: "archive_notified_3d_at", kind: "workshop_archive_3d", untilMs: 3 * 24 * 60 * 60 * 1000 },
    { flag: "archive_notified_24h_at", kind: "workshop_archive_24h", untilMs: 24 * 60 * 60 * 1000 },
    { flag: "archive_notified_6h_at", kind: "workshop_archive_6h", untilMs: 6 * 60 * 60 * 1000 },
  ];

  const warned: Record<string, number> = {};

  for (const w of windows) {
    const upper = new Date(nowMs + w.untilMs).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("workshops")
      .select("id,slug,title,archive_at,last_activity_at")
      .not("archive_at", "is", null)
      .is("archived_at", null)
      .is(w.flag, null)
      .lte("archive_at", upper)
      .gt("archive_at", nowIso)
      .limit(50);

    for (const ws of rows ?? []) {
      await notifyMembers(ws.id, w.kind, {
        title: ws.title,
        slug: ws.slug,
        archive_at: (ws as any).archive_at,
        last_activity_at: (ws as any).last_activity_at,
      });
      await supabaseAdmin
        .from("workshops")
        .update({ [w.flag]: nowIso } as any)
        .eq("id", ws.id);
    }
    warned[w.flag] = (rows ?? []).length;
  }

  // Time to clear the studio
  const { data: due } = await supabaseAdmin
    .from("workshops")
    .select("id,slug,title")
    .not("archive_at", "is", null)
    .is("archived_at", null)
    .lte("archive_at", nowIso)
    .limit(25);

  const cleared: string[] = [];
  for (const ws of due ?? []) {
    await clearStudio(ws.id);
    await supabaseAdmin
      .from("workshops")
      .update({ archived_at: nowIso })
      .eq("id", ws.id);
    await notifyMembers(ws.id, "workshop_archived", { title: ws.title, slug: ws.slug });
    cleared.push(ws.id);
  }

  return {
    warned_7d: warned.archive_notified_7d_at ?? 0,
    warned_3d: warned.archive_notified_3d_at ?? 0,
    warned_24h: warned.archive_notified_24h_at ?? 0,
    warned_6h: warned.archive_notified_6h_at ?? 0,
    cleared: cleared.length,
  };
}

async function notifyMembers(
  workshopId: string,
  kind: string,
  payload: Record<string, unknown>,
) {
  const { data: ws } = await supabaseAdmin
    .from("workshops")
    .select("host_user_id")
    .eq("id", workshopId)
    .maybeSingle();
  const { data: parts } = await supabaseAdmin
    .from("workshop_participants")
    .select("user_id")
    .eq("workshop_id", workshopId)
    .in("participant_status", ["confirmed", "checked_in", "completed"]);
  const recipients = Array.from(
    new Set([...(parts ?? []).map((p) => p.user_id), ws?.host_user_id].filter(Boolean)),
  ) as string[];
  if (recipients.length === 0) return;
  await supabaseAdmin
    .from("notifications")
    .insert(
      recipients.map((uid) => ({
        user_id: uid,
        kind,
        entity_type: "workshop",
        entity_id: workshopId,
        payload: payload as any,
      })),
    )
    .then(() => null, () => null);
}

async function clearStudio(workshopId: string) {
  // Delete tool data. Storage objects for drive files are best-effort cleaned;
  // the archive manifest already captured download URLs for members.
  const { data: files } = await supabaseAdmin
    .from("workshop_drive_files")
    .select("storage_path")
    .eq("workshop_id", workshopId);
  const paths = (files ?? []).map((f) => f.storage_path).filter(Boolean);
  if (paths.length) {
    await supabaseAdmin.storage.from("work-files").remove(paths).then(
      () => null,
      () => null,
    );
  }

  const tables = [
    "workshop_doc_comments",
    "workshop_docs",
    "workshop_drive_file_comments",
    "workshop_drive_files",
    "workshop_drive_links",
    "workshop_tasks",
    "workshop_board_assets",
    "workshop_polls", // cascades to workshop_poll_votes
    "workshop_messages",
  ];
  for (const t of tables) {
    await (supabaseAdmin.from(t as any) as any)
      .delete()
      .eq("workshop_id", workshopId)
      .then(() => null, () => null);
  }
}
