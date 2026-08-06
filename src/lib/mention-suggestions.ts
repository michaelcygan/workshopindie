import { useQuery } from "@tanstack/react-query";
import { entityMarkdown } from "@/lib/entities/kinds";
import {
  searchWorks,
  searchCollabs,
  searchGroups,
  searchEvents,
  searchProfiles,
  searchBlogPosts,
  type EntitySearchHit,
} from "@/lib/entities/search";

/**
 * `@` typeahead hooks for every conversational surface (Lounge chat, DMs,
 * Today board).
 *
 * These are now thin adapters over the single Workshop entity search in
 * `@/lib/entities/search`, called with the `conversation` context. The queries
 * themselves live there so the Blog "About this post" picker and the `@`
 * popover can never drift apart again. What stays here is the composer-facing
 * shape: a flat suggestion with the exact text to insert.
 */

export type MentionKind = "user" | "collab" | "group" | "event" | "work" | "post";

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

/** Entity hit -> composer suggestion. Inserts route through `entityMarkdown`. */
function toSuggestion(hit: EntitySearchHit, kind: MentionKind): MentionSuggestion {
  return {
    kind,
    id: hit.id,
    label: hit.label,
    sublabel: hit.sublabel ?? null,
    avatar: hit.image ?? null,
    insert:
      hit.kind === "profile" ? `@${hit.username} ` : `${entityMarkdown(hit)} `,
  };
}

/** People search — global by handle. */
export function useUserSuggestions(query: string, enabled: boolean) {
  const q = query.trim().toLowerCase();
  return useQuery({
    queryKey: ["mention-users", q],
    enabled: enabled && q.length >= 1,
    staleTime: 30_000,
    queryFn: async (): Promise<MentionSuggestion[]> => {
      const hits = await searchProfiles({ query: q, context: "conversation", limit: LIMIT });
      return hits.map((h) => toSuggestion(h, "user"));
    },
  });
}

/** The signed-in user's collabs that are still taking people. */
export function useMyCollabSuggestions(
  userId: string | undefined,
  query: string,
  enabled: boolean,
) {
  const q = query.trim().toLowerCase();
  return useQuery({
    queryKey: ["mention-my-collabs", userId ?? "anon", q],
    enabled: enabled && !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<MentionSuggestion[]> => {
      const hits = await searchCollabs({
        query: q,
        viewerId: userId,
        context: "conversation",
        limit: LIMIT,
      });
      return hits.filter((h) => h.mine).map((h) => toSuggestion(h, "collab"));
    },
  });
}

/** Groups the user belongs to first, then public groups by name. */
export function useGroupSuggestions(userId: string | undefined, query: string, enabled: boolean) {
  const q = query.trim().toLowerCase();
  return useQuery({
    queryKey: ["mention-groups", userId ?? "anon", q],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<MentionSuggestion[]> => {
      const hits = await searchGroups({
        query: q,
        viewerId: userId,
        context: "conversation",
        limit: LIMIT,
      });
      return hits.map((h) => toSuggestion(h, "group"));
    },
  });
}

/** Upcoming public Group Events. */
export function useEventSuggestions(userId: string | undefined, query: string, enabled: boolean) {
  const q = query.trim().toLowerCase();
  return useQuery({
    queryKey: ["mention-events", userId ?? "anon", q],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<MentionSuggestion[]> => {
      const hits = await searchEvents({
        query: q,
        viewerId: userId,
        context: "conversation",
        limit: LIMIT,
      });
      return hits.map((h) => toSuggestion(h, "event"));
    },
  });
}

/** Works — the viewer's own first, then everyone else's. */
export function useWorkSuggestions(userId: string | undefined, query: string, enabled: boolean) {
  const q = query.trim().toLowerCase();
  return useQuery({
    queryKey: ["mention-works", userId ?? "anon", q],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<MentionSuggestion[]> => {
      const hits = await searchWorks({
        query: q,
        viewerId: userId,
        context: "conversation",
        limit: LIMIT,
      });
      return hits.map((h) => toSuggestion(h, "work"));
    },
  });
}

/** Blog post search — global by title across every live post. */
export function useBlogPostSuggestions(query: string, enabled: boolean) {
  const q = query.trim().toLowerCase();
  return useQuery({
    queryKey: ["mention-posts", q],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<MentionSuggestion[]> => {
      const hits = await searchBlogPosts({ query: q, context: "conversation", limit: LIMIT });
      return hits.map((h) => toSuggestion(h, "post"));
    },
  });
}
