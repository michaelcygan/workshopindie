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
    // Ignore unique-violation: idempotent join
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

const tagSchema = z.object({
  group_id: z.string().uuid(),
  entity_id: z.string().uuid(),
  entity: z.enum(["work", "collab", "workshop"]),
});

export const tagPostInGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tagSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const table =
      data.entity === "work"
        ? "group_works"
        : data.entity === "collab"
          ? "group_collabs"
          : "group_workshops";
    const col =
      data.entity === "work"
        ? "work_id"
        : data.entity === "collab"
          ? "collab_post_id"
          : "workshop_id";
    const { error } = await supabase
      .from(table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({ group_id: data.group_id, [col]: data.entity_id, added_by: userId } as any);
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });

export const untagPostInGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => tagSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const table =
      data.entity === "work"
        ? "group_works"
        : data.entity === "collab"
          ? "group_collabs"
          : "group_workshops";
    const col =
      data.entity === "work"
        ? "work_id"
        : data.entity === "collab"
          ? "collab_post_id"
          : "workshop_id";
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("group_id", data.group_id)
      .eq(col, data.entity_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
