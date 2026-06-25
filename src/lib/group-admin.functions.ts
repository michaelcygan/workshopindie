import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin only");
}

const slugRe = /^[a-z0-9-]+$/;

const createSchema = z.object({
  slug: z.string().min(2).max(60).regex(slugRe, "lowercase, numbers, hyphens only"),
  name: z.string().min(2).max(80),
  kind: z.enum(["city", "genre", "micro", "scene"]),
  city_id: z.string().uuid().nullable().optional(),
  tagline: z.string().max(140).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  cover_url: z.string().url().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  accent_color: z.string().max(20).nullable().optional(),
  is_official: z.boolean().optional(),
  featured: z.boolean().optional(),
  visibility: z.enum(["public", "unlisted"]).optional(),
});

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => createSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: row, error } = await supabase
      .from("groups")
      .insert({
        slug: data.slug,
        name: data.name,
        kind: data.kind,
        city_id: data.city_id ?? null,
        tagline: data.tagline ?? null,
        description: data.description ?? null,
        cover_url: data.cover_url ?? null,
        avatar_url: data.avatar_url ?? null,
        accent_color: data.accent_color ?? null,
        is_official: data.is_official ?? true,
        featured_at: data.featured ? new Date().toISOString() : null,
        visibility: data.visibility ?? "public",
        created_by: userId,
      })
      .select("id,slug")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const updateSchema = createSchema.partial().extend({ id: z.string().uuid() });
type UpdatePatch = {
  slug?: string;
  name?: string;
  kind?: "city" | "genre" | "micro" | "scene";
  city_id?: string | null;
  tagline?: string | null;
  description?: string | null;
  cover_url?: string | null;
  avatar_url?: string | null;
  accent_color?: string | null;
  is_official?: boolean;
  visibility?: "public" | "unlisted";
  featured_at?: string | null;
};

export const updateGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { id, featured, ...rest } = data;
    const patch: UpdatePatch = { ...rest };
    if (typeof featured === "boolean") {
      patch.featured_at = featured ? new Date().toISOString() : null;
    }
    const { error } = await supabase.from("groups").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("groups")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const seedGroupMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        group_id: z.string().uuid(),
        user_ids: z.array(z.string().uuid()).min(1).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const rows = data.user_ids.map((uid) => ({ group_id: data.group_id, user_id: uid }));
    const { error } = await supabase
      .from("group_members")
      .upsert(rows, { onConflict: "group_id,user_id" });
    if (error) throw new Error(error.message);
    return { ok: true, added: rows.length };
  });

export const setGroupParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        group_id: z.string().uuid(),
        parent_group_id: z.string().uuid().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("groups")
      .update({ parent_group_id: data.parent_group_id })
      .eq("id", data.group_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
