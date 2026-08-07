/**
 * Server-only influence logic. Called from src/lib/influences.functions.ts
 * handlers via dynamic import so it never enters the client graph.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { normalizeUrl } from "@/lib/url-normalize";
import { checkUrlSafety, safeImageUrl, safetyMessage } from "@/lib/url-metadata/safety";
import {
  clampText,
  detectProvider,
  cleanUrl,
  categoryFor,
  resolveUrlMetadata,
} from "@/lib/url-metadata/resolve";
import { MAX_INFLUENCES } from "@/lib/influences/schemas";
import type { AddInfluenceInput, ResolvedInfluenceMeta } from "@/lib/influences/schemas";

type Db = SupabaseClient<Database>;

/** Strip tracking params + trailing slash so duplicates collapse reliably. */
export function normalizedKey(url: string): string {
  const cleaned = cleanUrl(url);
  try {
    const u = new URL(cleaned);
    u.hash = "";
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}${u.search}`.toLowerCase();
  } catch {
    return cleaned.toLowerCase();
  }
}

async function logBlockedUrl(userId: string, host: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("moderation_events").insert({
      user_id: userId,
      surface: "influence_url",
      subject_id: host,
      category: "link",
      severity: "block",
    });
  } catch {
    /* logging must never block the user path */
  }
}

/**
 * Validate (and optionally resolve) an external influence URL.
 * Throws with a user-facing message when the URL is unsafe.
 */
export async function prepareExternalInfluence(
  rawUrl: string,
  userId: string,
  opts: { resolve: boolean },
): Promise<ResolvedInfluenceMeta> {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) throw new Error("That doesn't look like a valid link.");

  const check = checkUrlSafety(normalized);
  if (!check.ok) {
    if (check.reason === "blocked") {
      try {
        await logBlockedUrl(userId, new URL(normalized).hostname.replace(/^www\./, ""));
      } catch {
        /* ignore */
      }
    }
    throw new Error(safetyMessage(check.reason));
  }

  const cleaned = cleanUrl(check.url.toString());
  const provider = detectProvider(check.url);
  const fallback: ResolvedInfluenceMeta = {
    url: cleaned,
    title: null,
    creator_name: null,
    category: categoryFor(provider),
    thumbnail_url: null,
    provider,
  };
  if (!opts.resolve) return fallback;

  const meta = await resolveUrlMetadata(cleaned);
  if (!meta) return fallback;
  return {
    url: meta.primary_url || cleaned,
    title: clampText(meta.title, 200),
    creator_name: clampText(meta.book?.author ?? meta.author_name, 160),
    category: meta.suggested_category ?? fallback.category,
    thumbnail_url: safeImageUrl(meta.cover_url),
    provider: meta.provider,
  };
}

async function nextPosition(db: Db, userId: string): Promise<number> {
  const { data } = await db
    .from("profile_influences")
    .select("position")
    .eq("profile_id", userId)
    .order("position", { ascending: false })
    .limit(1);
  return (data?.[0]?.position ?? -1) + 1;
}

function friendlyDbError(message: string): string {
  if (/at most 10 influences/i.test(message))
    return `You can have at most ${MAX_INFLUENCES} influences.`;
  if (/uq_profile_influences_work/i.test(message))
    return "That Work is already one of your influences.";
  if (/uq_profile_influences_url/i.test(message))
    return "That link is already one of your influences.";
  return message;
}

export async function insertInfluence(db: Db, userId: string, input: AddInfluenceInput) {
  const position = await nextPosition(db, userId);

  if (input.kind === "workshop_work") {
    // Only Works the caller can actually see, and only live public ones.
    const { data: work, error: workErr } = await db
      .from("works")
      .select("id, title, slug, cover_url, category, status, visibility")
      .eq("id", input.work_id)
      .maybeSingle();
    if (workErr) throw new Error(friendlyDbError(workErr.message));
    if (!work || work.status !== "published" || !["public", "unlisted"].includes(work.visibility)) {
      throw new Error("That Work isn't available to add.");
    }
    const { data, error } = await db
      .from("profile_influences")
      .insert({
        profile_id: userId,
        position,
        source_kind: "workshop_work",
        work_id: work.id,
        title: clampText(work.title, 200),
        category: work.category,
        thumbnail_url: work.cover_url,
        provider: "workshop",
      })
      .select("id")
      .single();
    if (error) throw new Error(friendlyDbError(error.message));
    return { id: data.id };
  }

  const meta = await prepareExternalInfluence(input.url, userId, { resolve: false });
  const { data, error } = await db
    .from("profile_influences")
    .insert({
      profile_id: userId,
      position,
      source_kind: "external",
      external_url: meta.url,
      normalized_url: normalizedKey(meta.url),
      title:
        clampText(input.title, 200) ??
        clampText(meta.title, 200) ??
        new URL(meta.url).hostname.replace(/^www\./, ""),
      creator_name: clampText(input.creator_name, 160),
      category: clampText(input.category, 40) ?? meta.category,
      thumbnail_url: safeImageUrl(input.thumbnail_url) ?? meta.thumbnail_url,
      provider: clampText(input.provider, 40) ?? meta.provider,
    })
    .select("id")
    .single();
  if (error) throw new Error(friendlyDbError(error.message));
  return { id: data.id };
}

export async function patchInfluence(
  db: Db,
  userId: string,
  input: {
    id: string;
    title?: string | null;
    creator_name?: string | null;
    category?: string | null;
    thumbnail_url?: string | null;
  },
) {
  const patch: {
    title?: string | null;
    creator_name?: string | null;
    category?: string | null;
    thumbnail_url?: string | null;
  } = {};
  if (input.title !== undefined) patch.title = clampText(input.title, 200);
  if (input.creator_name !== undefined) patch.creator_name = clampText(input.creator_name, 160);
  if (input.category !== undefined) patch.category = clampText(input.category, 40);
  if (input.thumbnail_url !== undefined) patch.thumbnail_url = safeImageUrl(input.thumbnail_url);
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await db
    .from("profile_influences")
    .update(patch)
    .eq("id", input.id)
    .eq("profile_id", userId);
  if (error) throw new Error(friendlyDbError(error.message));
  return { ok: true };
}

export async function deleteInfluence(db: Db, userId: string, id: string) {
  const { error } = await db
    .from("profile_influences")
    .delete()
    .eq("id", id)
    .eq("profile_id", userId);
  if (error) throw new Error(friendlyDbError(error.message));
  await resequence(db, userId);
  return { ok: true };
}

async function resequence(db: Db, userId: string) {
  const { data } = await db
    .from("profile_influences")
    .select("id, position")
    .eq("profile_id", userId)
    .order("position", { ascending: true });
  if (!data) return;
  await Promise.all(
    data.map((row, i) =>
      row.position === i
        ? Promise.resolve()
        : db
            .from("profile_influences")
            .update({ position: i })
            .eq("id", row.id)
            .eq("profile_id", userId),
    ),
  );
}

export async function applyInfluenceOrder(db: Db, userId: string, ids: string[]) {
  const { data } = await db.from("profile_influences").select("id").eq("profile_id", userId);
  const owned = new Set((data ?? []).map((r) => r.id));
  const ordered = ids.filter((id) => owned.has(id));
  await Promise.all(
    ordered.map((id, i) =>
      db.from("profile_influences").update({ position: i }).eq("id", id).eq("profile_id", userId),
    ),
  );
  return { ok: true };
}
