import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ group_id: z.string().uuid() });

export const joinGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => idSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: data.group_id, user_id: userId });
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });

export const leaveGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => idSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", data.group_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyGroupIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ids: (data ?? []).map((r) => r.group_id as string) };
  });

const tagWorkSchema = z.object({ group_id: z.string().uuid(), work_id: z.string().uuid() });
const tagCollabSchema = z.object({ group_id: z.string().uuid(), collab_post_id: z.string().uuid() });
const tagWorkshopSchema = z.object({ group_id: z.string().uuid(), workshop_id: z.string().uuid() });

export const tagWorkInGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tagWorkSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("group_works")
      .insert({ group_id: data.group_id, work_id: data.work_id, added_by: userId });
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });

export const untagWorkInGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tagWorkSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("group_works")
      .delete()
      .eq("group_id", data.group_id)
      .eq("work_id", data.work_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const tagCollabInGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tagCollabSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("group_collabs")
      .insert({ group_id: data.group_id, collab_post_id: data.collab_post_id, added_by: userId });
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });

export const untagCollabInGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tagCollabSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("group_collabs")
      .delete()
      .eq("group_id", data.group_id)
      .eq("collab_post_id", data.collab_post_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const tagWorkshopInGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tagWorkshopSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("group_workshops")
      .insert({ group_id: data.group_id, workshop_id: data.workshop_id, added_by: userId });
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });

export const untagWorkshopInGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tagWorkshopSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("group_workshops")
      .delete()
      .eq("group_id", data.group_id)
      .eq("workshop_id", data.workshop_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
