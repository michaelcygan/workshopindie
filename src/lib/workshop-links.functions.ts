import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CATEGORIES = ["film", "music", "writing", "build", "visual", "critique", "business", "coworking"] as const;

function randToken(len = 8) {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}

async function ensureAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden");
}

export const createWorkshopLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      title: z.string().trim().min(1).max(120),
      prompt: z.string().trim().max(2000).optional().nullable(),
      category: z.enum(CATEGORIES).optional().nullable(),
      cover_url: z.string().url().optional().nullable(),
      participant_cap: z.number().int().min(2).max(12).default(5),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Insert with retry on token collision (extremely rare with 8-char base32)
    for (let i = 0; i < 4; i++) {
      const token = randToken(8);
      const { data: row, error } = await supabaseAdmin
        .from("workshop_links")
        .insert({
          token,
          title: data.title,
          prompt: data.prompt ?? null,
          category: data.category ?? null,
          cover_url: data.cover_url ?? null,
          participant_cap: data.participant_cap,
          created_by: userId,
        })
        .select("*")
        .single();
      if (!error && row) return { link: row };
      if (error && !`${error.message}`.toLowerCase().includes("duplicate")) {
        throw new Error(error.message);
      }
    }
    throw new Error("Couldn't generate a unique token, please try again");
  });

export const listWorkshopLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: links } = await supabaseAdmin
      .from("workshop_links")
      .select("*")
      .order("created_at", { ascending: false });
    const tokens = (links ?? []).map((l: any) => l.token);
    const liveByToken = new Map<string, number>();
    if (tokens.length > 0) {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { data: rooms } = await supabaseAdmin
        .from("instant_rooms")
        .select("id, link_token")
        .in("link_token", tokens)
        .eq("status", "active");
      const roomIds = (rooms ?? []).map((r: any) => r.id);
      if (roomIds.length > 0) {
        const { data: pres } = await supabaseAdmin
          .from("instant_presence")
          .select("room_id")
          .in("room_id", roomIds)
          .gt("last_seen_at", cutoff);
        const liveByRoom = new Map<string, number>();
        for (const p of pres ?? []) {
          liveByRoom.set(p.room_id as string, (liveByRoom.get(p.room_id as string) ?? 0) + 1);
        }
        for (const r of rooms ?? []) {
          const c = liveByRoom.get(r.id as string) ?? 0;
          liveByToken.set(r.link_token as string, (liveByToken.get(r.link_token as string) ?? 0) + c);
        }
      }
    }
    return {
      links: (links ?? []).map((l: any) => ({ ...l, live_count: liveByToken.get(l.token as string) ?? 0 })),
    };
  });

export const updateWorkshopLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      patch: z.object({
        title: z.string().trim().min(1).max(120).optional(),
        prompt: z.string().trim().max(2000).nullable().optional(),
        category: z.enum(CATEGORIES).nullable().optional(),
        cover_url: z.string().url().nullable().optional(),
        participant_cap: z.number().int().min(2).max(12).optional(),
        is_active: z.boolean().optional(),
      }),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("workshop_links")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { link: row };
  });

export const deleteWorkshopLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("workshop_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type PeekResult = {
  link: {
    token: string;
    title: string;
    prompt: string | null;
    category: string | null;
    cover_url: string | null;
    participant_cap: number;
  } | null;
  live_count: number;
};

/** Public — used by the /w/$token landing page loader. No auth required. */
export const peekLinkWorkshop = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(1).max(40) }).parse(input))
  .handler(async ({ data }): Promise<PeekResult> => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: link } = await sb
      .from("workshop_links")
      .select("token, title, prompt, category, cover_url, participant_cap, is_active")
      .eq("token", data.token)
      .eq("is_active", true)
      .maybeSingle();
    if (!link) return { link: null, live_count: 0 };

    // Count live participants across all active rooms for this token (best-effort)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const { data: rooms } = await supabaseAdmin
      .from("instant_rooms")
      .select("id")
      .eq("link_token", data.token)
      .eq("status", "active");
    let live = 0;
    const ids = (rooms ?? []).map((r: any) => r.id);
    if (ids.length > 0) {
      const { count } = await supabaseAdmin
        .from("instant_presence")
        .select("user_id", { count: "exact", head: true })
        .in("room_id", ids)
        .gt("last_seen_at", cutoff);
      live = count ?? 0;
    }
    const { is_active: _omit, ...pub } = link as any;
    return { link: pub, live_count: live };
  });

/** Authed — matchmake or spawn a Workshop for this link, return the room id. */
export const joinFromLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      token: z.string().min(1).max(40),
      excludeRoomIds: z.array(z.string().uuid()).max(20).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roomId, error } = await supabaseAdmin.rpc("join_link_workshop", {
      _user_id: context.userId,
      _token: data.token,
      _exclude_room_ids: data.excludeRoomIds ?? [],
    } as any);
    if (error) throw new Error(error.message);
    return { roomId: roomId as string };
  });
