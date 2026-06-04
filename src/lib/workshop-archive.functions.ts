import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Generate (or regenerate) the studio archive for a workshop. Members only.
 * Bundles docs, tasks, drive links, drive file metadata, polls, and a
 * manifest header into a single JSON archive in the workshop-archives bucket.
 */
export const generateWorkshopArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workshopId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { workshopId } = data;

    const { data: member } = await supabase.rpc("is_workshop_member", {
      _workshop_id: workshopId,
      _user_id: userId,
    });
    if (!member) throw new Error("Not a workshop member");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      { data: ws },
      { data: docs },
      { data: tasks },
      { data: links },
      { data: files },
      { data: polls },
      { data: parts },
    ] = await Promise.all([
      supabaseAdmin.from("workshops").select("*").eq("id", workshopId).maybeSingle(),
      supabaseAdmin.from("workshop_docs").select("*").eq("workshop_id", workshopId),
      supabaseAdmin.from("workshop_tasks").select("*").eq("workshop_id", workshopId),
      supabaseAdmin.from("workshop_drive_links").select("*").eq("workshop_id", workshopId),
      supabaseAdmin.from("workshop_drive_files").select("*").eq("workshop_id", workshopId),
      supabaseAdmin.from("workshop_polls").select("*, votes:workshop_poll_votes(choice_index)").eq("workshop_id", workshopId),
      supabaseAdmin
        .from("workshop_participants")
        .select("user_id,participant_status,role_id,profile:profiles!workshop_participants_user_id_fkey(display_name,username)")
        .eq("workshop_id", workshopId),
    ]);

    if (!ws) throw new Error("Workshop not found");

    // Sign URLs for drive files (24h)
    const filesWithUrls = await Promise.all(
      (files ?? []).map(async (f: any) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("work-files")
          .createSignedUrl(f.storage_path, 60 * 60 * 24 * 7);
        return { ...f, download_url: signed?.signedUrl ?? null };
      }),
    );

    const manifest = {
      generated_at: new Date().toISOString(),
      generated_by: userId,
      workshop: {
        id: ws.id,
        slug: (ws as any).slug,
        title: (ws as any).title,
        category: (ws as any).category,
        prompt: (ws as any).prompt,
        starts_at: (ws as any).starts_at,
        ends_at: (ws as any).ends_at,
        published_work_id: (ws as any).published_work_id,
        archive_at: (ws as any).archive_at,
      },
      members: parts ?? [],
      docs: docs ?? [],
      tasks: tasks ?? [],
      drive_links: links ?? [],
      drive_files: filesWithUrls,
      polls: polls ?? [],
    };

    const path = `${workshopId}/archive-${Date.now()}.json`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("workshop-archives")
      .upload(path, JSON.stringify(manifest, null, 2), {
        contentType: "application/json",
        upsert: true,
      });
    if (upErr) throw upErr;

    await supabaseAdmin
      .from("workshops")
      .update({ archive_zip_url: path } as any)
      .eq("id", workshopId);

    const { data: signed } = await supabaseAdmin.storage
      .from("workshop-archives")
      .createSignedUrl(path, 60 * 60 * 24);

    return { ok: true, path, signed_url: signed?.signedUrl ?? null };
  });

export const getWorkshopArchiveUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workshopId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member } = await supabase.rpc("is_workshop_member", {
      _workshop_id: data.workshopId,
      _user_id: userId,
    });
    if (!member) throw new Error("Not a workshop member");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ws } = await supabaseAdmin
      .from("workshops")
      .select("archive_zip_url,archived_at,archive_at,title,slug")
      .eq("id", data.workshopId)
      .maybeSingle();
    if (!ws) throw new Error("Workshop not found");

    let signedUrl: string | null = null;
    const path = (ws as any).archive_zip_url as string | null;
    if (path) {
      const { data: signed } = await supabaseAdmin.storage
        .from("workshop-archives")
        .createSignedUrl(path, 60 * 60 * 24);
      signedUrl = signed?.signedUrl ?? null;
    }
    return {
      title: (ws as any).title,
      slug: (ws as any).slug,
      archive_at: (ws as any).archive_at,
      archived_at: (ws as any).archived_at,
      signed_url: signedUrl,
      has_archive: !!path,
    };
  });
