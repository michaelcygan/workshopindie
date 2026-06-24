import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FLAGS } from "@/lib/flags";
import { VouchRow, useVouchersForWorks } from "./work-vouch-button";
import { BoostWorkButton } from "./work-boost-button";

export function WorkSocialProof({
  workId,
  createdBy,
  vouchCount,
  boostCount,
}: {
  workId: string;
  createdBy: string;
  vouchCount: number;
  boostCount: number;
}) {
  if (!FLAGS.BOOSTS && !FLAGS.VOUCHES) return null;
  // Realtime totals so the row updates without a full reload
  const { data: live } = useQuery({
    queryKey: ["work-social-counts", workId],
    queryFn: async () => {
      const { data } = await supabase
        .from("works")
        .select("vouch_count,boost_count")
        .eq("id", workId)
        .maybeSingle();
      return data ?? { vouch_count: vouchCount, boost_count: boostCount };
    },
    staleTime: 15_000,
    initialData: { vouch_count: vouchCount, boost_count: boostCount },
  });

  const { data: vouchersMap } = useVouchersForWorks([workId]);
  const vouchers = vouchersMap.get(workId) ?? [];

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface p-3 shadow-soft">
      <div className="flex flex-wrap items-center gap-3">
        <BoostWorkButton workId={workId} createdBy={createdBy} size="md" />
        {(live?.boost_count ?? 0) > 0 && (
          <span className="text-xs text-ink-muted">
            Boosted by {live.boost_count} {live.boost_count === 1 ? "person" : "people"}
          </span>
        )}
      </div>
      <VouchRow
        workId={workId}
        createdBy={createdBy}
        vouchCount={live?.vouch_count ?? vouchCount}
        vouchers={vouchers}
        className="mt-3"
      />
    </div>
  );
}
