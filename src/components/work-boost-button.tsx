import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Rocket } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { boostWork, unboostWork } from "@/lib/work-boosts.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function useMyWorkBoost() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-work-boost", user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<string | null> => {
      if (!user) return null;
      const { data } = await supabase
        .from("work_boosts")
        .select("work_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return (data?.work_id as string | null) ?? null;
    },
    staleTime: 30_000,
  });
}

export function BoostWorkButton({
  workId,
  createdBy,
  className,
  size = "sm",
}: {
  workId: string;
  createdBy: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: myBoostId } = useMyWorkBoost();
  const boost = useServerFn(boostWork);
  const unboost = useServerFn(unboostWork);

  const isBoosted = myBoostId === workId;
  const hasOtherBoost = !!myBoostId && myBoostId !== workId;
  const isCreator = !!user && user.id === createdBy;

  const mut = useMutation({
    mutationFn: async () => {
      if (isBoosted) await unboost({ data: { workId } });
      else await boost({ data: { workId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-work-boost"] });
      qc.invalidateQueries({ queryKey: ["boosted-works"] });
      qc.invalidateQueries({ queryKey: ["gallery"] });
      qc.invalidateQueries({ queryKey: ["work-vouchers-batch"] });
      qc.invalidateQueries({ queryKey: ["work", workId] });
      if (!isBoosted) {
        toast.success(hasOtherBoost ? "Boost moved to this Work" : "Boosted");
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
    if (isCreator) {
      toast("You can't boost your own Work");
      return;
    }
    mut.mutate();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={mut.isPending || isCreator}
      className={cn(
        "relative z-20 inline-flex items-center gap-1 rounded-full border font-medium transition",
        size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3.5 py-1.5 text-sm",
        isBoosted
          ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-border bg-surface text-ink hover:bg-muted",
        isCreator && "opacity-40 cursor-not-allowed",
        className,
      )}
      aria-pressed={isBoosted}
      title={
        hasOtherBoost && !isBoosted
          ? "This will move your boost from your current pick"
          : undefined
      }
    >
      <Rocket className="h-3.5 w-3.5" />
      {isBoosted ? "Boosted" : hasOtherBoost ? "Move boost" : "Boost"}
    </button>
  );
}
