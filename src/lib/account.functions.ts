import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function slugifyHandle(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

/**
 * Auto-mint a username from the user's first+last (or display_name) if they
 * don't have one yet. Never overwrites a user-chosen handle. Returns the
 * effective username so callers can navigate to /u/$username immediately.
 */
export const claimAutoUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: profile, error: readErr } = await supabaseAdmin
      .from("profiles")
      .select("username, first_name, last_name, display_name")
      .eq("id", userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (profile?.username) return { username: profile.username };

    const base =
      slugifyHandle(`${profile?.first_name ?? ""}${profile?.last_name ?? ""}`) ||
      slugifyHandle(profile?.display_name ?? "") ||
      `user${userId.slice(0, 6)}`;

    const candidates: string[] = [base];
    for (let i = 0; i < 6; i++) {
      candidates.push(`${base}${Math.random().toString(36).slice(2, 5)}`);
    }
    candidates.push(`user${userId.slice(0, 8)}`);

    for (const candidate of candidates) {
      if (!candidate || candidate.length < 2) continue;
      const { data: taken } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", candidate)
        .maybeSingle();
      if (taken) continue;
      const { error: updErr } = await supabaseAdmin
        .from("profiles")
        .update({ username: candidate })
        .eq("id", userId)
        .is("username", null);
      if (!updErr) return { username: candidate };
    }
    throw new Error("Couldn't reserve a username. Try setting one in profile settings.");
  });



/** Read the signed-in user's account-level privacy settings. */
export const getMyPrivacy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("dm_policy, discoverable, indexable, show_online")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      dmPolicy: (data?.dm_policy as "mutuals" | "everyone" | "nobody" | null) ?? "mutuals",
      discoverable: data?.discoverable ?? true,
      indexable: data?.indexable ?? true,
      showOnline: data?.show_online ?? true,
    };
  });

/** Update one or more of the user's privacy settings. */
export const updateMyPrivacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        dmPolicy: z.enum(["mutuals", "everyone", "nobody"]).optional(),
        discoverable: z.boolean().optional(),
        indexable: z.boolean().optional(),
        showOnline: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const patch: {
      dm_policy?: string;
      discoverable?: boolean;
      indexable?: boolean;
      show_online?: boolean;
    } = {};
    if (data.dmPolicy !== undefined) patch.dm_policy = data.dmPolicy;
    if (data.discoverable !== undefined) patch.discoverable = data.discoverable;
    if (data.indexable !== undefined) patch.indexable = data.indexable;
    if (data.showOnline !== undefined) patch.show_online = data.showOnline;
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
      db.from("works").select("*").eq("created_by", userId).limit(500),
      db.from("collab_posts").select("*").eq("user_id", userId).limit(500),
      db.from("workshops").select("*").eq("host_user_id", userId).limit(500),
      db.from("workshop_applications").select("*").eq("user_id", userId).limit(1000),
      db.from("comments").select("*").eq("user_id", userId).limit(2000),
      db.from("follows").select("*").eq("follower_user_id", userId).limit(2000),
      db.from("follows").select("*").eq("followed_user_id", userId).limit(2000),
      db.from("user_blocks").select("*").eq("blocker_user_id", userId).limit(500),
      db.from("reports").select("*").eq("reporter_user_id", userId).limit(500),
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
