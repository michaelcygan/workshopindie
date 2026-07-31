import { useRouter } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radio } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { joinGroupLounge } from "@/lib/instant.functions";

/**
 * Today-tab module surfacing this Group's Lounge with a live presence count,
 * so Group Lounges are discoverable from inside the Group itself.
 */
export function GroupLoungeCard({ groupId }: { groupId: string }) {
  const router = useRouter();
  const joinFn = useServerFn(joinGroupLounge);

  const { data: liveCount = 0 } = useQuery({
    queryKey: ["group-lounge-live", groupId],
    refetchInterval: 45_000,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: rooms } = await supabase
        .from("instant_rooms")
        .select("id")
        .eq("group_id", groupId)
        .eq("status", "active")
        .limit(5);
      const ids = (rooms ?? []).map((r) => r.id as string);
      if (ids.length === 0) return 0;
      const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("instant_presence")
        .select("user_id", { count: "exact", head: true })
        .in("room_id", ids)
        .gt("last_seen_at", since);
      return count ?? 0;
    },
  });

  const open = useMutation({
    mutationFn: () => joinFn({ data: { groupId } }),
    onSuccess: ({ roomId }) =>
      router.navigate({ to: "/lounge/$id", params: { id: roomId }, search: { mode: "chat" } }),
    onError: (e: Error) => toast.error(e.message ?? "Couldn't open the Lounge"),
  });

  return (
    <section className="flex h-full flex-col rounded-2xl border border-border/60 bg-surface p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
        <Radio className="h-3.5 w-3.5" /> Group Lounge
      </div>
      <p className="mt-2 text-sm text-ink">
        {liveCount > 0
          ? `${liveCount} ${liveCount === 1 ? "person is" : "people are"} in the Lounge right now.`
          : "Nobody's in yet — open it and others can drop in."}
      </p>
      <button
        type="button"
        disabled={open.isPending}
        onClick={() => open.mutate()}
        className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        <span className="relative inline-flex h-1.5 w-1.5">
          {liveCount > 0 && (
            <span className="absolute inset-0 animate-ping rounded-full bg-primary-foreground/70" />
          )}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-foreground" />
        </span>
        {liveCount > 0 ? "Join the Lounge" : "Open the Lounge"}
      </button>
    </section>
  );
}
