import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { vouchCollab, unvouchCollab } from "@/lib/collab-vouches.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Voucher = {
  user_id: string;
  follows_viewer?: boolean;
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

export function VouchRow({
  postId,
  authorId,
  vouchCount,
  vouchers,
  className,
}: {
  postId: string;
  authorId: string;
  vouchCount: number;
  vouchers: Voucher[];
  className?: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const vouch = useServerFn(vouchCollab);
  const unvouch = useServerFn(unvouchCollab);

  const viewerVouched = !!user && vouchers.some((v) => v.user_id === user.id);
  const isAuthor = !!user && user.id === authorId;
  const followedVouchers = vouchers.filter((v) => v.follows_viewer);
  const display = (followedVouchers.length > 0 ? followedVouchers : vouchers).slice(0, 3);

  const mut = useMutation({
    mutationFn: async () => {
      if (viewerVouched) await unvouch({ data: { collabPostId: postId } });
      else await vouch({ data: { collabPostId: postId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collab"] });
      qc.invalidateQueries({ queryKey: ["collab-vouchers", postId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast("Sign in to vouch", {
        action: { label: "Sign in", onClick: () => (window.location.href = "/login") },
      });
      return;
    }
    if (isAuthor) {
      toast("You can't vouch for your own Collab");
      return;
    }
    mut.mutate();
  }

  if (vouchCount === 0 && !user) return null;

  let label: string;
  if (followedVouchers.length > 0) {
    const first = followedVouchers[0].profile?.display_name
      ?? followedVouchers[0].profile?.username
      ?? "Someone";
    const rest = vouchCount - 1;
    label = rest > 0 ? `Vouched by ${first} + ${rest} ${rest === 1 ? "other" : "others"}` : `Vouched by ${first}`;
  } else if (vouchCount > 0) {
    label = `Vouched by ${vouchCount} ${vouchCount === 1 ? "person" : "people"}`;
  } else {
    label = "Be the first to vouch";
  }

  return (
    <div className={cn("relative z-20 flex items-center gap-2 text-xs", className)}>
      <div className="flex -space-x-1.5">
        {display.length === 0 ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-ink-soft">
            <ShieldCheck className="h-3 w-3" />
          </span>
        ) : (
          display.map((v) =>
            v.profile?.avatar_url ? (
              <img
                key={v.user_id}
                src={v.profile.avatar_url}
                alt=""
                className="h-5 w-5 rounded-full border border-surface object-cover"
                loading="lazy"
              />
            ) : (
              <span
                key={v.user_id}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-surface bg-muted text-[9px] font-medium text-ink-soft"
              >
                {(v.profile?.display_name ?? v.profile?.username ?? "·").charAt(0).toUpperCase()}
              </span>
            ),
          )
        )}
      </div>
      <span className="truncate text-ink-soft">{label}</span>
      <button
        type="button"
        onClick={handleClick}
        disabled={mut.isPending || isAuthor}
        className={cn(
          "ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
          viewerVouched
            ? "border-transparent bg-ink text-background hover:bg-ink/90"
            : "border-border bg-surface text-ink hover:bg-muted",
          isAuthor && "opacity-50 cursor-not-allowed",
        )}
        aria-pressed={viewerVouched}
      >
        <ShieldCheck className="h-3 w-3" />
        {viewerVouched ? "Vouched" : "Vouch"}
      </button>
    </div>
  );
}

// --- Data hook: batch fetch vouchers for a set of posts ---
export type VouchersByPost = Map<string, Voucher[]>;

export function useVouchersForPosts(postIds: string[]): {
  data: VouchersByPost;
  isLoading: boolean;
} {
  const { user } = useAuth();
  const key = postIds.slice().sort().join(",");
  const { data, isLoading } = useQuery({
    queryKey: ["collab-vouchers-batch", key, user?.id ?? null],
    enabled: postIds.length > 0,
    queryFn: async (): Promise<VouchersByPost> => {
      const { data: rows, error } = await supabase
        .from("collab_vouches")
        .select("collab_post_id,user_id,created_at")
        .in("collab_post_id", postIds)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id as string)));
      const profilesById = new Map<string, Voucher["profile"]>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,display_name,username,avatar_url")
          .in("id", userIds);
        for (const p of (profs ?? []) as Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null }>) {
          profilesById.set(p.id, { display_name: p.display_name, username: p.username, avatar_url: p.avatar_url });
        }
      }

      let followedIds = new Set<string>();
      if (user && userIds.length > 0) {
        const { data: f } = await supabase
          .from("follows")
          .select("followed_user_id")
          .eq("follower_user_id", user.id)
          .in("followed_user_id", userIds);
        followedIds = new Set((f ?? []).map((r) => r.followed_user_id as string));
      }

      const map: VouchersByPost = new Map();
      for (const r of (rows ?? []) as Array<{ collab_post_id: string; user_id: string }>) {
        const list = map.get(r.collab_post_id) ?? [];
        list.push({
          user_id: r.user_id,
          follows_viewer: followedIds.has(r.user_id),
          profile: profilesById.get(r.user_id) ?? null,
        });
        map.set(r.collab_post_id, list);
      }
      for (const [k, list] of map) {
        map.set(k, list.slice().sort((a, b) => Number(b.follows_viewer) - Number(a.follows_viewer)));
      }
      return map;
    },
    staleTime: 30_000,
  });
  return { data: data ?? new Map(), isLoading };
}

