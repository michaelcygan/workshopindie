import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SIGNED_URL_TTL = 60 * 60; // 1h

export type EventPhoto = {
  id: string;
  event_id: string;
  uploader_id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  created_at: string;
  url: string | null;
  uploader: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

/**
 * List photos for an event. Returns short-lived signed URLs.
 * Returns [] on any failure — never blank the page.
 */
export const listEventPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<EventPhoto[]> => {
    try {
      const { supabase } = context;
      const { data: rows, error } = await supabase
        .from("event_photos")
        .select("id,event_id,uploader_id,storage_path,width,height,created_at")
        .eq("event_id", data.event_id)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error || !rows) return [];

      const paths = rows.map((r) => r.storage_path);
      const signed = paths.length
        ? (await supabase.storage.from("event-photos").createSignedUrls(paths, SIGNED_URL_TTL)).data ?? []
        : [];
      const urlByPath = new Map(signed.map((s) => [s.path ?? "", s.signedUrl ?? null]));

      const uploaderIds = Array.from(new Set(rows.map((r) => r.uploader_id)));
      const { data: profs } = uploaderIds.length
        ? await supabase
            .from("profiles")
            .select("id,display_name,username,avatar_url")
            .in("id", uploaderIds)
        : { data: [] as { id: string; display_name: string | null; username: string | null; avatar_url: string | null }[] };
      const profById = new Map((profs ?? []).map((p) => [p.id, p]));

      return rows.map((r) => {
        const p = profById.get(r.uploader_id);
        return {
          id: r.id,
          event_id: r.event_id,
          uploader_id: r.uploader_id,
          storage_path: r.storage_path,
          width: r.width,
          height: r.height,
          created_at: r.created_at,
          url: urlByPath.get(r.storage_path) ?? null,
          uploader: p
            ? { display_name: p.display_name, username: p.username, avatar_url: p.avatar_url }
            : null,
        };
      });
    } catch {
      return [];
    }
  });

/**
 * Record a photo row after a successful client upload.
 * RLS enforces attendance + uploader = self.
 */
export const recordEventPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        event_id: z.string().uuid(),
        storage_path: z.string().min(1).max(500),
        width: z.number().int().positive().nullable().optional(),
        height: z.number().int().positive().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Enforce the 3-day post-event upload window.
    const { data: ev } = await supabase
      .from("group_events")
      .select("ends_at")
      .eq("id", data.event_id)
      .maybeSingle();
    if (ev?.ends_at) {
      const sealsAt = new Date(new Date(ev.ends_at).getTime() + 3 * 24 * 60 * 60 * 1000);
      if (new Date() > sealsAt) throw new Error("Photo uploads are closed for this event.");
    }
    const { data: row, error } = await supabase
      .from("event_photos")
      .insert({
        event_id: data.event_id,
        uploader_id: userId,
        storage_path: data.storage_path,
        width: data.width ?? null,
        height: data.height ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteEventPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("event_photos")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabase.from("event_photos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.storage_path) {
      await supabase.storage.from("event-photos").remove([row.storage_path]).catch(() => {});
    }
    return { ok: true };
  });
