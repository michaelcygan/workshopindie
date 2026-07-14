import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared suggestion hooks for the `@` typeahead popover used across chat
 * surfaces (Lounge chat, DMs, Today board). Each returns a small, capped
 * list keyed by a lowercased query string. All queries are debounced by
 * React Query's own dedupe/staleness; callers should still gate on the
 * popover being open via `enabled`.
 */

export type MentionKind = "user" | "collab" | "group" | "event" | "work";

export type MentionSuggestion = {
  kind: MentionKind;
  id: string;
  label: string;
  sublabel: string | null;
  avatar: string | null;
  /** The exact text inserted into the composer when the user picks this. */
  insert: string;
};

const LIMIT = 6;

/**
 * People search — global by handle (ilike prefix). Used to broaden the
 * per-room participant list in ChatMentionInput and to seed DM/Today.
 */
export function useUserSuggestions(query: string, enabled: boolean) {
  const q = query.trim().toLowerCase();
  return useQuery({
    queryKey: ["mention-users", q],
    enabled: enabled && q.length >= 1,
    staleTime: 30_000,
    queryFn: async (): Promise<MentionSuggestion[]> => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .ilike("username", `${q}%`)
        .not("username", "is", null)
        .limit(LIMIT);
      return (data ?? [])
        .filter((p) => p.username)
        .map((p) => ({
          kind: "user" as const,
          id: p.id,
          label: p.display_name || (p.username as string),
          sublabel: `@${p.username}`,
          avatar: p.avatar_url,
          insert: `@${p.username} `,
        }));
    },
  });
}

/**
 * The signed-in user's open Collabs, filtered by title. Mirrors the collab
 * source used on the Today board.
 */
export function useMyCollabSuggestions(userId: string | undefined, query: string, enabled: boolean) {
  const q = query.trim().toLowerCase();
  return useQuery({
    queryKey: ["mention-my-collabs", userId ?? "anon", q],
    enabled: enabled && !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<MentionSuggestion[]> => {
      let req = supabase
        .from("collab_posts")
        .select("id,title,slug,status")
        .eq("user_id", userId!)
        .eq("status", "open")
        .limit(LIMIT);
      if (q) req = req.ilike("title", `%${q}%`);
      const { data } = await req;
      return (data ?? []).map((row) => ({
        kind: "collab" as const,
        id: row.id,
        label: row.title,
        sublabel: "Your collab",
        avatar: null,
        insert: `[${row.title}](/collab/${row.slug}) `,
      }));
    },
  });
}

/**
 * Groups the user belongs to first, then a global search by name (public
 * groups; unlisted require membership, handled by RLS).
 */
export function useGroupSuggestions(userId: string | undefined, query: string, enabled: boolean) {
  const q = query.trim().toLowerCase();
  return useQuery({
    queryKey: ["mention-groups", userId ?? "anon", q],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<MentionSuggestion[]> => {
      const seen = new Set<string>();
      const out: MentionSuggestion[] = [];

      // 1) My groups first.
      if (userId) {
        const { data: memberRows } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", userId)
          .limit(200);
        const ids = (memberRows ?? []).map((r) => r.group_id as string);
        if (ids.length > 0) {
          let mine = supabase
            .from("groups")
            .select("id,name,slug,tagline,avatar_url")
            .in("id", ids)
            .is("deleted_at", null)
            .limit(LIMIT);
          if (q) mine = mine.ilike("name", `%${q}%`);
          const { data } = await mine;
          for (const g of data ?? []) {
            if (seen.has(g.id)) continue;
            seen.add(g.id);
            out.push({
              kind: "group",
              id: g.id,
              label: g.name,
              sublabel: g.tagline || "Group you're in",
              avatar: g.avatar_url,
              insert: `[${g.name}](/g/${g.slug}) `,
            });
          }
        }
      }

      // 2) Public group search to fill remaining slots.
      if (out.length < LIMIT && q) {
        let pub = supabase
          .from("groups")
          .select("id,name,slug,tagline,avatar_url")
          .eq("visibility", "public")
          .is("deleted_at", null)
          .ilike("name", `%${q}%`)
          .limit(LIMIT);
        const { data } = await pub;
        for (const g of data ?? []) {
          if (seen.has(g.id)) continue;
          seen.add(g.id);
          out.push({
            kind: "group",
            id: g.id,
            label: g.name,
            sublabel: g.tagline || "Group",
            avatar: g.avatar_url,
            insert: `[${g.name}](/g/${g.slug}) `,
          });
          if (out.length >= LIMIT) break;
        }
      }

      return out.slice(0, LIMIT);
    },
  });
}

/**
 * Upcoming Group Events. Queries events joined with their group so the
 * insert produces the fully-qualified /g/<slug>/e/<eventSlug> route.
 */
export function useEventSuggestions(userId: string | undefined, query: string, enabled: boolean) {
  const q = query.trim().toLowerCase();
  return useQuery({
    queryKey: ["mention-events", userId ?? "anon", q],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<MentionSuggestion[]> => {
      const nowIso = new Date().toISOString();
      let req = supabase
        .from("group_events")
        .select(
          "id,slug,title,tagline,cover_url,starts_at,group:groups!group_events_group_id_fkey(slug,name)",
        )
        .gte("starts_at", nowIso)
        .is("deleted_at", null)
        .order("starts_at", { ascending: true })
        .limit(LIMIT * 2);
      if (q) req = req.ilike("title", `%${q}%`);
      const { data } = await req;
      const rows = (data ?? []) as unknown as Array<{
        id: string;
        slug: string;
        title: string;
        tagline: string | null;
        cover_url: string | null;
        starts_at: string;
        group: { slug: string; name: string } | null;
      }>;
      return rows
        .filter((r) => r.group?.slug)
        .slice(0, LIMIT)
        .map((r) => {
          const when = new Date(r.starts_at).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          return {
            kind: "event" as const,
            id: r.id,
            label: r.title,
            sublabel: `${r.group!.name} · ${when}`,
            avatar: r.cover_url,
            insert: `[${r.title}](/g/${r.group!.slug}/e/${r.slug}) `,
          };
        });
    },
  });
}

/**
 * Works search — global by title. Ranks the signed-in user's own works
 * first so "@my <title>" is trivially reachable, then everyone else's.
 */
export function useWorkSuggestions(userId: string | undefined, query: string, enabled: boolean) {
  const q = query.trim().toLowerCase();
  return useQuery({
    queryKey: ["mention-works", userId ?? "anon", q],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<MentionSuggestion[]> => {
      const seen = new Set<string>();
      const out: MentionSuggestion[] = [];
      const CATEGORY_LABEL = (c: string | null) =>
        c ? c.charAt(0).toUpperCase() + c.slice(1) : "Work";

      const push = (
        rows: Array<{
          id: string;
          title: string;
          slug: string;
          category: string | null;
          cover_url: string | null;
        }>,
        sublabelPrefix?: string,
      ) => {
        for (const r of rows) {
          if (seen.has(r.id)) continue;
          seen.add(r.id);
          out.push({
            kind: "work",
            id: r.id,
            label: r.title,
            sublabel: sublabelPrefix ?? CATEGORY_LABEL(r.category),
            avatar: r.cover_url,
            insert: `[${r.title}](/works/${r.slug}) `,
          });
          if (out.length >= LIMIT) break;
        }
      };

      // 1) Own works first.
      if (userId) {
        let mine = supabase
          .from("works")
          .select("id,title,slug,category,cover_url")
          .eq("created_by", userId)
          .eq("status", "published")
          .in("visibility", ["public", "unlisted"])
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(LIMIT);
        if (q) mine = mine.ilike("title", `%${q}%`);
        const { data } = await mine;
        push((data ?? []) as never, "Your piece");
      }

      // 2) Everyone else's — fill to LIMIT.
      if (out.length < LIMIT && q) {
        const { data } = await supabase
          .from("works")
          .select("id,title,slug,category,cover_url")
          .eq("status", "published")
          .in("visibility", ["public", "unlisted"])
          .ilike("title", `%${q}%`)
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(LIMIT);
        push((data ?? []) as never);
      }

      return out.slice(0, LIMIT);
    },
  });
}
