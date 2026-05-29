import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Read the signed-in user's account-level privacy settings. */
export const getMyPrivacy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("dm_policy, discoverable, indexable")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      dmPolicy: (data?.dm_policy as "everyone" | "nobody" | null) ?? "everyone",
      discoverable: data?.discoverable ?? true,
      indexable: data?.indexable ?? true,
    };
  });

/** Update one or more of the user's privacy settings. */
export const updateMyPrivacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        dmPolicy: z.enum(["everyone", "nobody"]).optional(),
        discoverable: z.boolean().optional(),
        indexable: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const patch: {
      dm_policy?: string;
      discoverable?: boolean;
      indexable?: boolean;
    } = {};
    if (data.dmPolicy !== undefined) patch.dm_policy = data.dmPolicy;
    if (data.discoverable !== undefined) patch.discoverable = data.discoverable;
    if (data.indexable !== undefined) patch.indexable = data.indexable;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Permanently delete the signed-in user's account.
 * Soft-deletes the profile (so credits/works keep their FK references)
 * and hard-deletes the auth user. Requires typed confirmation client-side.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ confirm: z.literal("DELETE") }).parse(input),
  )
  .handler(async ({ context }) => {
    const { userId } = context;

    // Mark profile as deleted and scrub public-facing fields so the profile
    // page shows "Deleted user" instead of stale identity.
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({
        deleted_at: new Date().toISOString(),
        discoverable: false,
        indexable: false,
        dm_policy: "nobody",
        username: null,
        display_name: null,
        first_name: null,
        last_name: null,
        bio: null,
        headline: null,
        avatar_url: null,
        cover_url: null,
        instagram_handle: null,
        external_links: [],
      })
      .eq("id", userId);
    if (profErr) throw new Error(profErr.message);

    // Hard-delete the auth user. Cascades end the session.
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authErr) throw new Error(authErr.message);

    return { ok: true };
  });

/**
 * Export the signed-in user's data as a JSON snapshot.
 * Includes profile, privacy, notification prefs, works, collab posts,
 * workshops hosted, applications, comments, follows, blocks, and reports filed.
 */
export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const db = supabaseAdmin;

    const [
      profile,
      notifPrefs,
      works,
      collabPosts,
      workshopsHosted,
      applications,
      comments,
      following,
      followers,
      blocks,
      reportsFiled,
    ] = await Promise.all([
      db.from("profiles").select("*").eq("id", userId).maybeSingle(),
      db.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
      db.from("works").select("*").eq("created_by", userId),
      db.from("collab_posts").select("*").eq("creator_user_id", userId),
      db.from("workshops").select("*").eq("host_user_id", userId),
      db.from("workshop_applications").select("*").eq("applicant_user_id", userId),
      db.from("comments").select("*").eq("author_user_id", userId),
      db.from("follows").select("*").eq("follower_user_id", userId),
      db.from("follows").select("*").eq("followed_user_id", userId),
      db.from("user_blocks").select("*").eq("blocker_user_id", userId),
      db.from("reports").select("*").eq("reporter_user_id", userId),
    ]);

    return {
      exported_at: new Date().toISOString(),
      user_id: userId,
      profile: profile.data ?? null,
      notification_preferences: notifPrefs.data ?? null,
      works: works.data ?? [],
      collab_posts: collabPosts.data ?? [],
      workshops_hosted: workshopsHosted.data ?? [],
      workshop_applications: applications.data ?? [],
      comments: comments.data ?? [],
      following: following.data ?? [],
      followers: followers.data ?? [],
      blocked_users: blocks.data ?? [],
      reports_filed: reportsFiled.data ?? [],
    };
  });
