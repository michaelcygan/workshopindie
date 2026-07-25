import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles").select("role")
    .eq("user_id", context.userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

export const getUserBlogAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [mode, grant] = await Promise.all([
      supabaseAdmin.rpc("blog_writer_access_state", { _user_id: data.userId }),
      supabaseAdmin
        .from("blog_writer_access")
        .select("status,note,expires_at,granted_at,granted_by")
        .eq("user_id", data.userId)
        .maybeSingle(),
    ]);
    return {
      mode: (mode.data as string | null) ?? "free",
      grant: grant.data ?? null,
    };
  });

export const grantUserBlogAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      userId: z.string().uuid(),
      note: z.string().trim().max(200).nullable().optional(),
      expiresAt: z.string().datetime().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("blog_writer_access")
      .upsert(
        {
          user_id: data.userId,
          status: "granted",
          note: data.note ?? null,
          expires_at: data.expiresAt ?? null,
          granted_at: new Date().toISOString(),
          granted_by: context.userId,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_audit_log").insert({
      action: "blog_writer_access.granted",
      target_type: "profile",
      target_id: data.userId,
      actor_user_id: context.userId,
      payload: { note: data.note ?? null, expiresAt: data.expiresAt ?? null },
    });
    return { ok: true };
  });

export const revokeUserBlogAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("blog_writer_access")
      .delete()
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_audit_log").insert({
      action: "blog_writer_access.revoked",
      target_type: "profile",
      target_id: data.userId,
      actor_user_id: context.userId,
      payload: {},
    });
    return { ok: true };
  });

export const suspendUserBlogAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), note: z.string().trim().max(200).nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("blog_writer_access")
      .upsert(
        {
          user_id: data.userId,
          status: "suspended",
          note: data.note ?? null,
          granted_at: new Date().toISOString(),
          granted_by: context.userId,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_audit_log").insert({
      action: "blog_writer_access.suspended",
      target_type: "profile",
      target_id: data.userId,
      actor_user_id: context.userId,
      payload: { note: data.note ?? null },
    });
    return { ok: true };
  });
