import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Rocket } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { boostCollab, unboostCollab } from "@/lib/collab-boosts.functions";
import { FLAGS } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function useMyBoost() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-collab-boost", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<string | null> => {
      if (!user) return null;
      const { data } = await supabase
        .from("collab_boosts")
        .select("collab_post_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return (data?.collab_post_id as string | null) ?? null;
    },
    staleTime: 30_000,
  });
}

export function BoostButton({
  postId,
  authorId,
  className,
  size = "sm",
}: {
  postId: string;
  authorId: string;
  className?: string;
  size?: "sm" | "md";
}) {
  if (!FLAGS.BOOSTS) return null;
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: myBoostId } = useMyBoost();
  const boost = useServerFn(boostCollab);
  const unboost = useServerFn(unboostCollab);

  const isBoosted = myBoostId === postId;
  const hasOtherBoost = !!myBoostId && myBoostId !== postId;
  const isAuthor = !!user && user.id === authorId;

  const mut = useMutation({
    mutationFn: async () => {
      if (isBoosted) {
        await unboost({ data: { collabPostId: postId } });
      } else {
        await boost({ data: { collabPostId: postId } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-collab-boost"] });
      qc.invalidateQueries({ queryKey: ["collab-boosted"] });
      qc.invalidateQueries({ queryKey: ["collab"] });
      qc.invalidateQueries({ queryKey: ["collab-vouchers-batch"] });
      if (!isBoosted) {
        toast.success(hasOtherBoost ? "Boost moved to this Collab" : "Boosted");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast("Sign in to boost", {
        action: { label: "Sign in", onClick: () => (window.location.href = "/login") },
      });
      return;
    }
    if (isAuthor) {
      toast("You can't boost your own Collab");
      return;
    }
    mut.mutate();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={mut.isPending || isAuthor}
      className={cn(
        "relative z-20 inline-flex items-center gap-1 rounded-full border font-medium transition",
        size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        isBoosted
          ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-border bg-surface text-ink hover:bg-muted",
        isAuthor && "opacity-40 cursor-not-allowed",
        className,
      )}
      aria-pressed={isBoosted}
      title={hasOtherBoost && !isBoosted ? "This will move your boost from your current pick" : undefined}
    >
      <Rocket className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      {isBoosted ? "Boosted" : "Boost"}
    </button>
  );
}
