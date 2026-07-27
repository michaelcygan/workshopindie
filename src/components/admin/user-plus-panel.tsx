import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import {
  listUserPlusGrants,
  createAdminPlusGrant,
  revokeAdminPlusGrant,
} from "@/lib/admin-plus-grants.functions";

export function UserPlusPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listUserPlusGrants);
  const createFn = useServerFn(createAdminPlusGrant);
  const revokeFn = useServerFn(revokeAdminPlusGrant);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "plus-grants", userId],
    queryFn: () => listFn({ data: { userId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "plus-grants", userId] });

  const [benefitType, setBenefitType] = useState<"months" | "lifetime">("months");
  const [months, setMonths] = useState("1");
  const [note, setNote] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          userId,
          benefitType,
          durationMonths: benefitType === "months" ? Number(months || 0) : null,
          note: note.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Plus granted");
      setNote("");
      setMonths("1");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { grantId: id, reason: null } }),
    onSuccess: () => {
      toast.success("Grant revoked");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const access = data?.access;
  const grants = data?.grants ?? [];

  const showLifetimeWarning =
    benefitType === "lifetime" && access?.paidSubscription != null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-gradient-motion" />
        <h3 className="font-display text-lg text-ink">Workshop Plus</h3>
      </div>

      {isLoading ? (
        <div className="mt-3 text-sm text-ink-muted">Loading…</div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {access?.isPlus ? (
              <>
                <Badge className="bg-emerald-100 text-emerald-800">Plus active</Badge>
                <span className="text-ink-muted">via {access.source}</span>
                {access.lifetime ? (
                  <Badge variant="outline">Lifetime</Badge>
                ) : access.accessEndsAt ? (
                  <span className="text-ink-muted">
                    ends {new Date(access.accessEndsAt).toLocaleDateString()}
                  </span>
                ) : null}
                {access.paidSubscription && (
                  <span className="text-xs text-ink-muted">
                    · Stripe {access.paidSubscription.status}
                  </span>
                )}
              </>
            ) : (
              <Badge variant="outline">Free</Badge>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr_auto]">
            <Select value={benefitType} onValueChange={(v) => setBenefitType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="months">Months</SelectItem>
                <SelectItem value="lifetime">Lifetime</SelectItem>
              </SelectContent>
            </Select>
            {benefitType === "months" ? (
              <Input
                type="number"
                min={1}
                max={120}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                placeholder="months"
              />
            ) : (
              <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-ink-muted">
                Permanent access. Reversible via Revoke below.
              </div>
            )}
            <Button
              className="gradient-motion rounded-full text-primary-foreground"
              disabled={create.isPending || (benefitType === "months" && !Number(months))}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Granting…" : "Grant"}
            </Button>
          </div>
          <Textarea
            className="mt-2"
            rows={2}
            placeholder="Optional note (why is this being granted?)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {showLifetimeWarning && (
            <p className="mt-2 text-xs text-amber-700">
              Note: this user has an active Stripe subscription. Billing continues unless canceled separately in Stripe.
            </p>
          )}

          <div className="mt-5">
            <div className="mb-1 text-xs uppercase tracking-wide text-ink-muted">Grant ledger</div>
            {grants.length === 0 ? (
              <div className="text-sm text-ink-muted">No grants yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-ink-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">Kind</th>
                      <th className="px-2 py-1 text-left">Source</th>
                      <th className="px-2 py-1 text-left">Window</th>
                      <th className="px-2 py-1 text-left">Status</th>
                      <th className="px-2 py-1 text-left">By</th>
                      <th className="px-2 py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {grants.map((g: any) => (
                      <tr key={g.id} className="border-t border-border">
                        <td className="px-2 py-1.5">
                          {g.benefit_type === "lifetime" ? "Lifetime" : `${g.duration_months} mo`}
                        </td>
                        <td className="px-2 py-1.5 text-ink-muted">{g.source}</td>
                        <td className="px-2 py-1.5 text-ink-muted text-xs">
                          {g.access_starts_at ? new Date(g.access_starts_at).toLocaleDateString() : "—"}
                          {" → "}
                          {g.benefit_type === "lifetime"
                            ? "∞"
                            : g.access_ends_at
                            ? new Date(g.access_ends_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          {g.status === "active" || g.status === "applied_to_stripe" ? (
                            <Badge className="bg-emerald-100 text-emerald-800">{g.status}</Badge>
                          ) : (
                            <Badge variant="outline">{g.status}</Badge>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-ink-muted">
                          {g.grantedByProfile?.username ? `@${g.grantedByProfile.username}` : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {g.status === "active" || g.status === "applied_to_stripe" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (confirm("Revoke this grant?")) revoke.mutate(g.id);
                              }}
                            >
                              Revoke
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
