import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================================
// Helpers
// ============================================================================

// Supabase client comes from requireSupabaseAuth context; loose-typed here
// because helper boundaries don't need the full Database generic.
async function assertOwner(supabase: any, workId: string, userId: string) {
  const { data, error } = await supabase
    .from("works")
    .select("id, created_by")
    .eq("id", workId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.created_by !== userId) throw new Error("Forbidden");
  return data;
}

async function assertMember(supabase: any, workId: string, userId: string) {
  const { data: w } = await supabase
    .from("works")
    .select("id, created_by")
    .eq("id", workId)
    .maybeSingle();
  if (w?.created_by === userId) return;
  const { data: c } = await supabase
    .from("work_collaborators")
    .select("id")
    .eq("work_id", workId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!c) throw new Error("Forbidden");
}

async function logActivity(
  supabase: any,
  workId: string,
  actorId: string,
  kind: string,
  payload: Record<string, unknown> = {},
) {
  await supabase
    .from("work_activity")
    .insert({ work_id: workId, actor_id: actorId, kind, payload });
}

// ============================================================================
// WORK CREATION — deal-memo gate
// ============================================================================

const splitSchema = z.object({
  user_id: z.string().uuid().nullable(),
  role: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120).optional(),
  pct: z.number().min(0).max(100),
});

const createWorkSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  category: z.enum([
    "film", "music", "writing", "build", "visual",
    "critique", "business", "mentorship", "coworking",
  ]),
  visibility: z.enum(["private", "public", "invite_only"]).default("private"),
  license: z.enum([
    "cc_by",
    "rights_managed_externally",
    "portfolio_credit_only",
    "private",
  ]).default("cc_by"),
  license_custom: z.string().trim().max(2000).optional().nullable(),
  credit_template: z.string().trim().max(500).optional().nullable(),
  commercial_use: z.enum(["yes", "no", "negotiable"]).default("negotiable"),
  splits: z.array(splitSchema).min(1).max(20),
  source_workshop_id: z.string().uuid().optional().nullable(),
});

function hashAgreement(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export const createCollaborativeWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createWorkSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const totalPct = data.splits.reduce((s, x) => s + x.pct, 0);
    if (Math.round(totalPct) !== 100) {
      throw new Error("Splits must total 100%");
    }

    // 1. Insert the work as a collaborative draft
    const { data: work, error: wErr } = await supabase
      .from("works")
      .insert({
        title: data.title,
        description: data.description ?? null,
        category: data.category,
        visibility: data.visibility,
        license_type: data.license === "custom" ? "cc_by" : data.license,
        status: "draft",
        is_collaborative: true,
        credit_template: data.credit_template ?? null,
        commercial_use: data.commercial_use,
        source_type: data.source_workshop_id ? "workshop" : "manual",
        source_workshop_id: data.source_workshop_id ?? null,
        created_by: userId,
      })
      .select("id, slug")
      .single();
    if (wErr || !work) throw new Error(wErr?.message ?? "Failed to create work");

    // 2. Add owner as collaborator
    const ownerSplit = data.splits.find((s) => s.user_id === userId);
    await supabase.from("work_collaborators").insert({
      work_id: work.id,
      user_id: userId,
      role: ownerSplit?.role ?? "owner",
      splits_pct: ownerSplit?.pct ?? 100,
    });

    // 3. Create agreement v1 + auto-sign as owner
    const agreementPayload = {
      license: data.license,
      license_custom: data.license_custom ?? null,
      credit_template: data.credit_template ?? null,
      splits: data.splits,
      commercial_use: data.commercial_use,
      created_at: new Date().toISOString(),
    };
    const contentHash = hashAgreement(agreementPayload);

    const { data: agreement, error: aErr } = await supabase
      .from("work_agreements")
      .insert({
        work_id: work.id,
        version: 1,
        license: data.license === "custom" ? "cc_by" : data.license,
        license_custom: data.license_custom ?? null,
        credit_template: data.credit_template ?? null,
        splits: data.splits,
        commercial_use: data.commercial_use,
        content_hash: contentHash,
        created_by: userId,
      })
      .select("id")
      .single();
    if (aErr || !agreement) throw new Error(aErr?.message ?? "Failed to record agreement");

    await supabase.from("work_agreement_signatures").insert({
      agreement_id: agreement.id,
      user_id: userId,
    });

    await supabase
      .from("work_collaborators")
      .update({ signed_agreement_id: agreement.id })
      .eq("work_id", work.id)
      .eq("user_id", userId);

    await logActivity(supabase, work.id, userId, "work_created", {
      visibility: data.visibility,
      title: data.title,
    });

    return { workId: work.id, slug: work.slug };
  });

// ============================================================================
// WORK OVERVIEW
// ============================================================================

export const getWorkTools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: work, error } = await supabase
      .from("works")
      .select(
        "id, title, slug, description, category, visibility, status, is_collaborative, credit_template, commercial_use, created_by, created_at",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!work) throw new Error("Not found");

    const isOwner = work.created_by === userId;
    let isMember = isOwner;
    if (!isMember) {
      const { data: c } = await supabase
        .from("work_collaborators")
        .select("id")
        .eq("work_id", work.id)
        .eq("user_id", userId)
        .maybeSingle();
      isMember = !!c;
    }
    if (!isMember) throw new Error("Forbidden");

    const [collabsRes, countsRes, agreementRes] = await Promise.all([
      supabase
        .from("work_collaborators")
        .select(
          "id, role, splits_pct, joined_at, user_id, profiles:profiles!work_collaborators_user_id_fkey(id, display_name, username, avatar_url)",
        )
        .eq("work_id", work.id),
      supabase
        .from("work_files")
        .select("id", { count: "exact", head: true })
        .eq("work_id", work.id),
      supabase
        .from("work_agreements")
        .select("id, version, license, license_custom, credit_template, splits, commercial_use, created_at")
        .eq("work_id", work.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      work,
      isOwner,
      collaborators: collabsRes.data ?? [],
      fileCount: countsRes.count ?? 0,
      agreement: agreementRes.data ?? null,
    };
  });

// ============================================================================
// FILES
// ============================================================================

export const listWorkFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workId: string }) =>
    z.object({ workId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, data.workId, userId);
    const { data: files, error } = await supabase
      .from("work_files")
      .select(
        "id, name, path, size_bytes, mime, kind, locked, uploaded_by, created_at, profiles:profiles!work_files_uploaded_by_fkey(display_name, username, avatar_url)",
      )
      .eq("work_id", data.workId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { files: files ?? [] };
  });

export const registerWorkFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workId: z.string().uuid(),
      path: z.string().min(1).max(1000),
      name: z.string().min(1).max(500),
      size_bytes: z.number().int().min(0),
      mime: z.string().max(255).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, data.workId, userId);
    const { data: file, error } = await supabase
      .from("work_files")
      .insert({
        work_id: data.workId,
        path: data.path,
        name: data.name,
        size_bytes: data.size_bytes,
        mime: data.mime ?? null,
        uploaded_by: userId,
      })
      .select("id, name, path, size_bytes, mime, created_at")
      .single();
    if (error || !file) throw new Error(error?.message ?? "Failed to register file");

    await logActivity(supabase, data.workId, userId, "file_uploaded", {
      file_id: file.id,
      name: file.name,
    });

    return { file };
  });

export const deleteWorkFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileId: string }) =>
    z.object({ fileId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: file } = await supabase
      .from("work_files")
      .select("id, work_id, path, name, uploaded_by")
      .eq("id", data.fileId)
      .maybeSingle();
    if (!file) throw new Error("Not found");

    // Owner or uploader can delete
    const { data: w } = await supabase
      .from("works")
      .select("created_by")
      .eq("id", file.work_id)
      .maybeSingle();
    if (file.uploaded_by !== userId && w?.created_by !== userId) {
      throw new Error("Forbidden");
    }

    await supabase.storage.from("work-files").remove([file.path]);
    await supabase.from("work_files").delete().eq("id", file.id);
    await logActivity(supabase, file.work_id, userId, "file_deleted", {
      name: file.name,
    });
    return { ok: true };
  });

export const signedFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileId: string }) =>
    z.object({ fileId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: file } = await supabase
      .from("work_files")
      .select("id, work_id, path")
      .eq("id", data.fileId)
      .maybeSingle();
    if (!file) throw new Error("Not found");
    await assertMember(supabase, file.work_id, userId);
    const { data: signed, error } = await supabase.storage
      .from("work-files")
      .createSignedUrl(file.path, 60 * 60);
    if (error || !signed) throw new Error(error?.message ?? "Failed to sign");
    return { url: signed.signedUrl };
  });

// ============================================================================
// DOCS (notepad)
// ============================================================================

export const listWorkDocs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workId: string }) =>
    z.object({ workId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, data.workId, userId);
    const { data: docs, error } = await supabase
      .from("work_docs")
      .select("id, title, content, kind, updated_at, updated_by")
      .eq("work_id", data.workId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { docs: docs ?? [] };
  });

export const upsertWorkDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workId: z.string().uuid(),
      docId: z.string().uuid().optional().nullable(),
      title: z.string().trim().min(1).max(200),
      content: z.string().max(200_000).default(""),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, data.workId, userId);

    if (data.docId) {
      const { error } = await supabase
        .from("work_docs")
        .update({
          title: data.title,
          content: { text: data.content },
          updated_by: userId,
        })
        .eq("id", data.docId)
        .eq("work_id", data.workId);
      if (error) throw new Error(error.message);
      return { docId: data.docId };
    }
    const { data: doc, error } = await supabase
      .from("work_docs")
      .insert({
        work_id: data.workId,
        title: data.title,
        content: { text: data.content },
        updated_by: userId,
      })
      .select("id")
      .single();
    if (error || !doc) throw new Error(error?.message ?? "Failed to save doc");
    await logActivity(supabase, data.workId, userId, "doc_created", {
      doc_id: doc.id,
      title: data.title,
    });
    return { docId: doc.id };
  });

export const deleteWorkDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { docId: string }) =>
    z.object({ docId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc } = await supabase
      .from("work_docs")
      .select("work_id")
      .eq("id", data.docId)
      .maybeSingle();
    if (!doc) throw new Error("Not found");
    await assertOwner(supabase, doc.work_id, userId);
    await supabase.from("work_docs").delete().eq("id", data.docId);
    return { ok: true };
  });

// ============================================================================
// TASKS
// ============================================================================

export const listWorkTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workId: string }) =>
    z.object({ workId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, data.workId, userId);
    const { data: tasks, error } = await supabase
      .from("work_tasks")
      .select(
        "id, title, done, due_at, assignee, sort_order, created_at, profiles:profiles!work_tasks_assignee_fkey(display_name, username, avatar_url)",
      )
      .eq("work_id", data.workId)
      .order("done", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { tasks: tasks ?? [] };
  });

export const addWorkTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workId: z.string().uuid(),
      title: z.string().trim().min(1).max(500),
      assignee: z.string().uuid().optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, data.workId, userId);
    const { data: task, error } = await supabase
      .from("work_tasks")
      .insert({
        work_id: data.workId,
        title: data.title,
        assignee: data.assignee ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !task) throw new Error(error?.message ?? "Failed");
    return { taskId: task.id };
  });

export const toggleWorkTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ taskId: z.string().uuid(), done: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: t } = await supabase
      .from("work_tasks")
      .select("work_id")
      .eq("id", data.taskId)
      .maybeSingle();
    if (!t) throw new Error("Not found");
    await assertMember(supabase, t.work_id, userId);
    await supabase
      .from("work_tasks")
      .update({ done: data.done })
      .eq("id", data.taskId);
    return { ok: true };
  });

export const deleteWorkTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { taskId: string }) =>
    z.object({ taskId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: t } = await supabase
      .from("work_tasks")
      .select("work_id")
      .eq("id", data.taskId)
      .maybeSingle();
    if (!t) throw new Error("Not found");
    await assertMember(supabase, t.work_id, userId);
    await supabase.from("work_tasks").delete().eq("id", data.taskId);
    return { ok: true };
  });

// ============================================================================
// LINKS
// ============================================================================

export const listWorkLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workId: string }) =>
    z.object({ workId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, data.workId, userId);
    const { data: links, error } = await supabase
      .from("work_links")
      .select("id, url, label, category, created_at, created_by")
      .eq("work_id", data.workId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { links: links ?? [] };
  });

export const addWorkLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workId: z.string().uuid(),
      url: z.string().url().max(2000),
      label: z.string().trim().min(1).max(200).optional().nullable(),
      category: z.enum(["reference", "repo", "demo", "brief", "asset", "other"]).default("reference"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, data.workId, userId);
    const { data: link, error } = await supabase
      .from("work_links")
      .insert({
        work_id: data.workId,
        url: data.url,
        label: data.label ?? null,
        category: data.category,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !link) throw new Error(error?.message ?? "Failed");
    return { linkId: link.id };
  });

export const deleteWorkLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { linkId: string }) =>
    z.object({ linkId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: l } = await supabase
      .from("work_links")
      .select("work_id")
      .eq("id", data.linkId)
      .maybeSingle();
    if (!l) throw new Error("Not found");
    await assertMember(supabase, l.work_id, userId);
    await supabase.from("work_links").delete().eq("id", data.linkId);
    return { ok: true };
  });

// ============================================================================
// ACTIVITY
// ============================================================================

export const listWorkActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workId: string }) =>
    z.object({ workId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, data.workId, userId);
    const { data: events, error } = await supabase
      .from("work_activity")
      .select(
        "id, kind, payload, created_at, actor_id, profiles:profiles!work_activity_actor_id_fkey(display_name, username, avatar_url)",
      )
      .eq("work_id", data.workId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { events: events ?? [] };
  });

// ============================================================================
// INVITES (link token + handle invite)
// ============================================================================

export const createWorkInviteToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workId: z.string().uuid(),
      expiresInDays: z.number().int().min(1).max(90).default(14),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, data.workId, userId);
    const token = randomBytes(18).toString("base64url");
    const expires_at = new Date(Date.now() + data.expiresInDays * 86400_000).toISOString();
    const { data: row, error } = await supabase
      .from("work_invite_tokens")
      .insert({
        work_id: data.workId,
        token,
        created_by: userId,
        expires_at,
      })
      .select("token, expires_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed");
    return row;
  });

export const redeemWorkInviteToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) =>
    z.object({ token: z.string().min(8).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tok } = await supabase
      .from("work_invite_tokens")
      .select("id, work_id, expires_at, uses_remaining")
      .eq("token", data.token)
      .maybeSingle();
    if (!tok) throw new Error("Invalid invite link");
    if (tok.expires_at && new Date(tok.expires_at) < new Date()) {
      throw new Error("Invite link expired");
    }

    // Get current agreement to bind sig
    const { data: agreement } = await supabase
      .from("work_agreements")
      .select("id")
      .eq("work_id", tok.work_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabase.from("work_collaborators").upsert(
      {
        work_id: tok.work_id,
        user_id: userId,
        role: "collaborator",
        splits_pct: 0,
        signed_agreement_id: agreement?.id ?? null,
      },
      { onConflict: "work_id,user_id" },
    );

    if (agreement) {
      await supabase
        .from("work_agreement_signatures")
        .upsert(
          { agreement_id: agreement.id, user_id: userId },
          { onConflict: "agreement_id,user_id" },
        );
    }

    await logActivity(supabase, tok.work_id, userId, "joined_via_invite", {});

    const { data: w } = await supabase
      .from("works")
      .select("slug")
      .eq("id", tok.work_id)
      .maybeSingle();
    return { slug: w?.slug ?? null };
  });

// ============================================================================
// APPLICATIONS (public-apply mode)
// ============================================================================

export const applyToWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workId: z.string().uuid(),
      pitch: z.string().trim().max(2000).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: work } = await supabase
      .from("works")
      .select("id, visibility, created_by")
      .eq("id", data.workId)
      .maybeSingle();
    if (!work) throw new Error("Not found");
    if (work.visibility !== "public") {
      throw new Error("This Work is not open to applicants");
    }
    if (work.created_by === userId) throw new Error("You own this Work");
    const { error } = await supabase
      .from("work_applications")
      .upsert(
        { work_id: data.workId, applicant_user_id: userId, pitch: data.pitch ?? null, status: "pending" },
        { onConflict: "work_id,applicant_user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const respondToWorkApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      applicationId: z.string().uuid(),
      action: z.enum(["approve", "reject"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: app } = await supabase
      .from("work_applications")
      .select("id, work_id, applicant_user_id")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (!app) throw new Error("Not found");
    await assertOwner(supabase, app.work_id, userId);

    if (data.action === "approve") {
      const { data: agreement } = await supabase
        .from("work_agreements")
        .select("id")
        .eq("work_id", app.work_id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      await supabase.from("work_collaborators").upsert(
        {
          work_id: app.work_id,
          user_id: app.applicant_user_id,
          role: "collaborator",
          splits_pct: 0,
          signed_agreement_id: agreement?.id ?? null,
        },
        { onConflict: "work_id,user_id" },
      );
      await logActivity(supabase, app.work_id, userId, "application_approved", {
        applicant_user_id: app.applicant_user_id,
      });
    } else {
      await logActivity(supabase, app.work_id, userId, "application_rejected", {
        applicant_user_id: app.applicant_user_id,
      });
    }
    await supabase
      .from("work_applications")
      .update({ status: data.action === "approve" ? "approved" : "rejected" })
      .eq("id", data.applicationId);
    return { ok: true };
  });

// ============================================================================
// VISIBILITY toggle
// ============================================================================

export const setWorkVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workId: z.string().uuid(),
      visibility: z.enum(["private", "public", "invite_only"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, data.workId, userId);
    await supabase.from("works").update({ visibility: data.visibility }).eq("id", data.workId);
    await logActivity(supabase, data.workId, userId, "visibility_changed", {
      visibility: data.visibility,
    });
    return { ok: true };
  });
