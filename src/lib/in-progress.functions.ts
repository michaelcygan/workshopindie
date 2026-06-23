import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InProgressTask = {
  id: string;
  workshop_id: string;
  workshop_title: string;
  workshop_slug: string;
  title: string;
  body: string | null;
  due_by: string | null;
  status: string;
  reason: "assigned" | "mentioned";
  updated_at: string;
};

export type InProgressWorkshop = {
  id: string;
  slug: string;
  title: string;
  status: string;
  last_activity_at: string;
  ends_at: string | null;
};

export type InProgressCollab = {
  id: string;
  slug: string;
  title: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
};

export type InProgressBundle = {
  tasks: InProgressTask[];
  workshops: InProgressWorkshop[];
  collabs: InProgressCollab[];
};

/**
 * "In progress" daily-active surface. Single fetch, three sections, each
 * source returns [] on failure so a broken table never blanks the page.
 *
 * Sources:
 *  - Workshop tasks where the viewer is assignee OR mentioned, not done.
 *  - Workshops the viewer participates in that are still active-ish.
 *  - Open Collabs the viewer authored.
 *
 * No notifications, no badges, no gamification — read-only surface that
 * exists to answer "what should I work on right now?"
 */
export const getInProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({}).parse(i ?? {}))
  .handler(async ({ context }): Promise<InProgressBundle> => {
    const { supabase, userId } = context;

    const [tasksRes, workshopsRes, collabsRes] = await Promise.allSettled([
      loadTasks(supabase, userId),
      loadWorkshops(supabase, userId),
      loadCollabs(supabase, userId),
    ]);

    return {
      tasks: tasksRes.status === "fulfilled" ? tasksRes.value : [],
      workshops: workshopsRes.status === "fulfilled" ? workshopsRes.value : [],
      collabs: collabsRes.status === "fulfilled" ? collabsRes.value : [],
    };
  });

/** Mark a workshop task complete. RLS already restricts who can touch tasks. */
export const completeWorkshopTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ task_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("workshop_tasks")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", data.task_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- internal loaders ----------

type SB = Parameters<Parameters<typeof getInProgress.middleware>[0][0]>[0] extends never ? never : never;
// (the type-fu above is unused; just keep handler-scoped any-ish helpers)

async function loadTasks(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
): Promise<InProgressTask[]> {
  try {
    // Assigned tasks
    const assignedQ = supabase
      .from("workshop_tasks")
      .select("id, workshop_id, title, body, due_by, status, updated_at, workshop:workshops!workshop_tasks_workshop_id_fkey(slug, title)")
      .is("completed_at", null)
      .eq("assignee_id", userId)
      .order("due_by", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(50);

    // Mentioned tasks (array contains)
    const mentionedQ = supabase
      .from("workshop_tasks")
      .select("id, workshop_id, title, body, due_by, status, updated_at, workshop:workshops!workshop_tasks_workshop_id_fkey(slug, title)")
      .is("completed_at", null)
      .contains("mentioned_user_ids", [userId])
      .order("updated_at", { ascending: false })
      .limit(50);

    const [aRes, mRes] = await Promise.all([assignedQ, mentionedQ]);

    type Row = {
      id: string; workshop_id: string; title: string; body: string | null;
      due_by: string | null; status: string; updated_at: string;
      workshop: { slug: string; title: string } | null;
    };
    const assigned = (aRes.data ?? []) as Row[];
    const mentioned = (mRes.data ?? []) as Row[];

    const seen = new Set<string>();
    const tasks: InProgressTask[] = [];
    for (const r of assigned) {
      if (!r.workshop || seen.has(r.id)) continue;
      seen.add(r.id);
      tasks.push({
        id: r.id, workshop_id: r.workshop_id,
        workshop_slug: r.workshop.slug, workshop_title: r.workshop.title,
        title: r.title, body: r.body, due_by: r.due_by, status: r.status,
        reason: "assigned", updated_at: r.updated_at,
      });
    }
    for (const r of mentioned) {
      if (!r.workshop || seen.has(r.id)) continue;
      seen.add(r.id);
      tasks.push({
        id: r.id, workshop_id: r.workshop_id,
        workshop_slug: r.workshop.slug, workshop_title: r.workshop.title,
        title: r.title, body: r.body, due_by: r.due_by, status: r.status,
        reason: "mentioned", updated_at: r.updated_at,
      });
    }
    return tasks;
  } catch {
    return [];
  }
}

async function loadWorkshops(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
): Promise<InProgressWorkshop[]> {
  try {
    const { data: parts } = await supabase
      .from("workshop_participants")
      .select("workshop_id")
      .eq("user_id", userId)
      .eq("participant_status", "confirmed")
      .limit(100);
    const ids = Array.from(new Set((parts ?? []).map((r: { workshop_id: string }) => r.workshop_id)));
    if (ids.length === 0) return [];
    const { data } = await supabase
      .from("workshops")
      .select("id, slug, title, status, last_activity_at, ends_at")
      .in("id", ids)
      .in("status", ["open", "check_in", "active", "finalizing"])
      .order("last_activity_at", { ascending: false })
      .limit(20);
    return (data ?? []) as InProgressWorkshop[];
  } catch {
    return [];
  }
}

async function loadCollabs(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
): Promise<InProgressCollab[]> {
  try {
    const { data } = await supabase
      .from("collab_posts")
      .select("id, slug, title, status, starts_on, ends_on, created_at")
      .eq("user_id", userId)
      .in("status", ["open", "filling"])
      .order("created_at", { ascending: false })
      .limit(20);
    return (data ?? []) as InProgressCollab[];
  } catch {
    return [];
  }
}
