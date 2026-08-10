import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { domainError } from "@/lib/errors";
import { RESOURCE_CATEGORY_IDS } from "@/lib/resources/types";

const RESOURCE_SELECT =
  "id,name,category,useful_for,short_description,website_url,location_text,address,image_url,city_id,fields,is_published,created_at,updated_at";

async function ensureAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw domainError("FORBIDDEN", "Forbidden");
}

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const resourceInput = z.object({
  name: z.string().trim().min(1).max(160),
  category: z
    .enum(RESOURCE_CATEGORY_IDS as [string, ...string[]])
    .optional()
    .nullable(),
  useful_for: nullableText(400),
  short_description: nullableText(600),
  website_url: nullableText(500),
  location_text: nullableText(200),
  address: nullableText(300),
  image_url: nullableText(500),
  fields: z.array(z.string()).max(6).optional(),
  is_published: z.boolean().optional(),
});

export const listResourcesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: resources, error } = await supabaseAdmin
      .from("resources")
      .select(RESOURCE_SELECT)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    const { data: links, error: linkErr } = await supabaseAdmin
      .from("group_resources")
      .select("id,group_id,resource_id,display_order,groups(id,slug,name)")
      .order("display_order", { ascending: true });
    if (linkErr) throw linkErr;
    return { resources: resources ?? [], links: links ?? [] };
  });

export const createResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resourceInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("resources")
      .insert({ ...data, fields: data.fields ?? [], created_by: userId })
      .select(RESOURCE_SELECT)
      .single();
    if (error) throw error;
    return { resource: row };
  });

export const updateResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), patch: resourceInput.partial() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("resources")
      .update(data.patch)
      .eq("id", data.id)
      .select(RESOURCE_SELECT)
      .single();
    if (error) throw error;
    return { resource: row };
  });

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("resources").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const attachResourceToGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ resource_id: z.string().uuid(), group_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("group_resources")
      .select("id", { count: "exact", head: true })
      .eq("group_id", data.group_id);
    const { error } = await supabaseAdmin
      .from("group_resources")
      .upsert(
        { group_id: data.group_id, resource_id: data.resource_id, display_order: count ?? 0 },
        { onConflict: "group_id,resource_id" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const detachResourceFromGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ link_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("group_resources").delete().eq("id", data.link_id);
    if (error) throw error;
    return { ok: true };
  });

export const reorderGroupResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ link_id: z.string().uuid(), display_order: z.number().int().min(0).max(999) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("group_resources")
      .update({ display_order: data.display_order })
      .eq("id", data.link_id);
    if (error) throw error;
    return { ok: true };
  });
