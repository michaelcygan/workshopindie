/**
 * Group Links tab.
 *
 * Zero new write paths: this is a read-only projection of URLs already shared
 * in Today, so the moderation triggers on `group_today_posts` remain the only
 * gate on the underlying text. Blocked domains are filtered again at render.
 */
import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SharedLinksList, type SharedLinkMessage } from "@/components/shared-links-list";
import { extractUrls, isBlockedUrl } from "@/lib/moderation/url-blocklist";

type TodayLinkRow = SharedLinkMessage & {
  author?: { username: string | null; display_name: string | null } | null;
};

function linksQueryKey(groupId: string) {
  return ["group", groupId, "today-links"] as const;
}

async function fetchTodayLinkRows(groupId: string): Promise<TodayLinkRow[]> {
  const { data, error } = await supabase
    .from("group_today_posts")
    .select(
      "id,author_id,body,created_at,author:profiles!group_today_posts_author_profile_fkey(username,display_name)",
    )
    .eq("group_id", groupId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    user_id: r.author_id as string,
    body: (r.body as string) ?? "",
    created_at: r.created_at as string,
    author: (r as unknown as TodayLinkRow).author ?? null,
  })) as TodayLinkRow[];
}

/**
 * How many links are actually collected right now. Shares the Links tab's
 * query, so the section bar badge costs nothing extra, and applies the same
 * blocklist the list renders with — the count never promises more than the
 * section shows.
 */
export function useGroupLinkCount(groupId: string) {
  const { data: rows = [] } = useQuery({
    queryKey: linksQueryKey(groupId),
    staleTime: 30_000,
    queryFn: () => fetchTodayLinkRows(groupId),
  });
  let count = 0;
  for (const row of rows) {
    for (const url of extractUrls(row.body)) {
      if (!isBlockedUrl(url)) count += 1;
    }
  }
  return count;
}

export function GroupLinksTab({ group }: { group: { id: string; name: string } }) {
  const qc = useQueryClient();
  const queryKey = linksQueryKey(group.id);

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    staleTime: 30_000,
    queryFn: () => fetchTodayLinkRows(group.id),
  });

  useEffect(() => {
    const ch = supabase
      .channel(`group-links:${group.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_today_posts",
          filter: `group_id=eq.${group.id}`,
        },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, qc]);

  const resolveSenderName = useCallback(
    (userId: string) => {
      const row = rows.find((r) => r.user_id === userId);
      return row?.author?.display_name || row?.author?.username || "Someone";
    },
    [rows],
  );

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-ink-muted">Loading links…</div>;
  }

  return (
    <SharedLinksList
      messages={rows}
      resolveSenderName={resolveSenderName}
      emptyTitle="No links shared here yet"
      emptyHint={`Paste a link in ${group.name}'s Today conversation and it'll collect here.`}
    />
  );
}
