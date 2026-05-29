import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/me/blocked")({
  component: BlockedPage,
  head: () => ({
    meta: [{ title: "Blocked users — Workshop" }, { name: "robots", content: "noindex" }],
  }),
});

type BlockedRow = {
  blocked_user_id: string;
  created_at: string;
  profiles: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

function BlockedPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-blocks", user?.id],
    queryFn: async (): Promise<BlockedRow[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_blocks")
        .select("blocked_user_id, created_at, profiles:profiles!user_blocks_blocked_user_id_fkey(id,username,display_name,avatar_url)")
        .eq("blocker_user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        // Fallback if FK alias isn't named — do a manual join
        const { data: blocks } = await supabase
          .from("user_blocks")
          .select("blocked_user_id, created_at")
          .eq("blocker_user_id", user.id)
          .order("created_at", { ascending: false });
        const ids = (blocks ?? []).map((b) => b.blocked_user_id);
        if (ids.length === 0) return [];
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,username,display_name,avatar_url")
          .in("id", ids);
        const byId = new Map((profs ?? []).map((p) => [p.id, p]));
        return (blocks ?? []).map((b) => ({
          blocked_user_id: b.blocked_user_id,
          created_at: b.created_at,
          profiles: byId.get(b.blocked_user_id) ?? null,
        }));
      }
      return (data ?? []) as unknown as BlockedRow[];
    },
    enabled: !!user,
  });

  async function unblock(id: string) {
    if (!user) return;
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_user_id", user.id)
      .eq("blocked_user_id", id);
    if (error) return toast.error(error.message);
    toast.success("Unblocked");
    qc.invalidateQueries({ queryKey: ["my-blocks"] });
    qc.invalidateQueries({ queryKey: ["blocked-ids"] });
  }

  if (loading) return null;
  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-ink-muted">Sign in to manage your blocked users.</p>
        <Link to="/login"><Button className="mt-4 rounded-full">Sign in</Button></Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      <Link to="/me" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to profile
      </Link>
      <h1 className="mt-4 font-display text-3xl text-ink md:text-4xl">Blocked users</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Blocked users can't follow you, DM you, comment where you'll see it, or apply to your collabs and workshops.
        You also won't see their content in feeds.
      </p>

      <div className="mt-8">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
            <h3 className="font-display text-xl text-ink">You haven't blocked anyone.</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
              You can block someone from their profile at any time.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {data.map((row) => {
              const p = row.profiles;
              const name = p?.display_name || p?.username || "Unknown user";
              const initial = name.slice(0, 1).toUpperCase();
              return (
                <li key={row.blocked_user_id} className="flex items-center gap-3 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={p?.avatar_url ?? undefined} />
                    <AvatarFallback>{initial}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{name}</div>
                    {p?.username && (
                      <div className="truncate text-xs text-ink-muted">@{p.username}</div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full gap-1.5"
                    onClick={() => unblock(row.blocked_user_id)}
                  >
                    <Ban className="h-3.5 w-3.5" /> Unblock
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
