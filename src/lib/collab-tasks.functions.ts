import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { moderateOrThrow } from "@/lib/moderation/service.server";

export type CollabTaskStatus = "todo" | "in_progress" | "done";

export type CollabTask = {
  id: string;
  collab_post_id: string;
  title: string;
  status: CollabTaskStatus;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const TASK_COLS =
  "id,collab_post_id,title,status,sort_order,created_by,created_at,updated_at,completed_at";

export const listCollabTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ collabPostId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("collab_tasks")
      .select(TASK_COLS)
      .eq("collab_post_id", data.collabPostId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CollabTask[];
  });

export const createCollabTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        collabPostId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await moderateOrThrow({
      text: data.title,
      userId,
      surface: "collab_tasks",
      subjectId: data.collabPostId,
    });

    const { data: last, error: lastErr } = await supabase
      .from("collab_tasks")
      .select("sort_order")
      .eq("collab_post_id", data.collabPostId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastErr) throw new Error(lastErr.message);
    const nextOrder = (last?.sort_order ?? 0) + 1;

    const { data: row, error } = await supabase
      .from("collab_tasks")
      .insert({
        collab_post_id: data.collabPostId,
        title: data.title,
        status: "todo",
        sort_order: nextOrder,
        created_by: userId,
      })
      .select(TASK_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row as CollabTask;
  });

export const updateCollabTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        taskId: z.string().uuid(),
        patch: z
          .object({
            title: z.string().trim().min(1).max(200).optional(),
            status: z.enum(["todo", "in_progress", "done"]).optional(),
          })
          .refine((p) => p.title !== undefined || p.status !== undefined, {
            message: "Nothing to update",
          }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load existing row to know collab id + current status
    const { data: existing, error: exErr } = await supabase
      .from("collab_tasks")
      .select("id,collab_post_id,status")
      .eq("id", data.taskId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing) throw new Error("Task not found");

    if (data.patch.title !== undefined) {
      await moderateOrThrow({
        text: data.patch.title,
        userId,
        surface: "collab_tasks",
        subjectId: existing.collab_post_id,
      });
    }

    const patch: Record<string, unknown> = {};
    if (data.patch.title !== undefined) patch.title = data.patch.title;
    if (data.patch.status !== undefined) {
      patch.status = data.patch.status;
      if (data.patch.status === "done" && existing.status !== "done") {
        patch.completed_at = new Date().toISOString();
      } else if (data.patch.status !== "done" && existing.status === "done") {
        patch.completed_at = null;
      }
    }

    const { data: row, error } = await supabase
      .from("collab_tasks")
      .update(patch)
      .eq("id", data.taskId)
      .select(TASK_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row as CollabTask;
  });

export const reorderCollabTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        collabPostId: z.string().uuid(),
        orderedTaskIds: z
          .array(z.string().uuid())
          .min(1)
          .max(200)
          .refine((ids) => new Set(ids).size === ids.length, {
            message: "Duplicate task ids",
          }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("reorder_collab_tasks", {
      _collab_post_id: data.collabPostId,
      _ordered_ids: data.orderedTaskIds,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteCollabTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ taskId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("collab_tasks")
      .delete()
      .eq("id", data.taskId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
