import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Link2, Users } from "lucide-react";
import {
  adminCreatePlusOfferLink,
  adminListPlusOfferLinks,
  adminDeactivatePlusOfferLink,
  adminListOfferRedemptions,
} from "@/lib/plus-offers.functions";

export const Route = createFileRoute("/admin/plus")({
  component: AdminPlusPage,
  head: () => ({ meta: [{ title: "Plus Grants — Admin" }] }),
});

function claimUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/claim/${token}`;
}

function AdminPlusPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListPlusOfferLinks);
  const createFn = useServerFn(adminCreatePlusOfferLink);
  const deactivateFn = useServerFn(adminDeactivatePlusOfferLink);

  const { data: offers, isLoading } = useQuery({
    queryKey: ["admin", "plus-offers"],
    queryFn: () => listFn(),
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [benefitType, setBenefitType] = useState<"months" | "lifetime">("months");
  const [durationMonths, setDurationMonths] = useState<string>("1");
  const [maxRedemptions, setMaxRedemptions] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);
  const [redemptionsFor, setRedemptionsFor] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          name: name.trim(),
          description: description.trim() || null,
          benefitType,
          durationMonths: benefitType === "months" ? Number(durationMonths || 0) : null,
          maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        },
      }),
    onSuccess: (res: any) => {
      const url = claimUrl(res.token);
      setIssuedUrl(url);
      setName("");
      setDescription("");
      setDurationMonths("1");
      setMaxRedemptions("");
      setExpiresAt("");
      qc.invalidateQueries({ queryKey: ["admin", "plus-offers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => deactivateFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Offer deactivated");
      qc.invalidateQueries({ queryKey: ["admin", "plus-offers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-display text-xl text-ink">Create Plus offer link</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Generates a one-time URL you can share in campaigns. The token is shown once — copy it.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <div className="mb-1 text-ink-muted">Name</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Newsletter Q4 2026" />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-ink-muted">Benefit</div>
            <Select value={benefitType} onValueChange={(v) => setBenefitType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="months">Months</SelectItem>
                <SelectItem value="lifetime">Lifetime</SelectItem>
              </SelectContent>
            </Select>
          </label>
          {benefitType === "months" && (
            <label className="text-sm">
              <div className="mb-1 text-ink-muted">Duration (months)</div>
              <Input type="number" min={1} max={120} value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} />
            </label>
          )}
          <label className="text-sm">
            <div className="mb-1 text-ink-muted">Max redemptions (blank = unlimited)</div>
            <Input type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} placeholder="e.g. 100" />
          </label>
          <label className="text-sm md:col-span-2">
            <div className="mb-1 text-ink-muted">Expires at (blank = never)</div>
            <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </label>
          <label className="text-sm md:col-span-2">
            <div className="mb-1 text-ink-muted">Description (internal note)</div>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            className="gradient-motion rounded-full text-primary-foreground"
            disabled={!name.trim() || create.isPending || (benefitType === "months" && !Number(durationMonths))}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Creating…" : "Create offer link"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-display text-xl text-ink">Active & past offers</h2>
        {isLoading ? (
          <div className="mt-3 text-sm text-ink-muted">Loading…</div>
        ) : !offers || offers.length === 0 ? (
          <div className="mt-3 text-sm text-ink-muted">No offer links yet.</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-left">Benefit</th>
                  <th className="px-2 py-2 text-left">Redeemed</th>
                  <th className="px-2 py-2 text-left">Expires</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(offers as any[]).map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-2 py-2">
                      <div className="font-medium text-ink">{o.name}</div>
                      {o.description && <div className="text-xs text-ink-muted">{o.description}</div>}
                    </td>
                    <td className="px-2 py-2">
                      {o.benefit_type === "lifetime"
                        ? "Lifetime"
                        : `${o.duration_months} mo`}
                    </td>
                    <td className="px-2 py-2">
                      {o.redemption_count}
                      {o.max_redemptions ? ` / ${o.max_redemptions}` : ""}
                    </td>
                    <td className="px-2 py-2 text-ink-soft">
                      {o.expires_at ? new Date(o.expires_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-2 py-2">
                      {o.active ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setRedemptionsFor(o.id)}>
                          <Users className="mr-1 h-3 w-3" /> {o.redemption_count}
                        </Button>
                        {o.active && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (confirm("Deactivate this offer? Users can no longer claim it.")) {
                                deactivate.mutate(o.id);
                              }
                            }}
                          >
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!issuedUrl} onOpenChange={(v) => !v && setIssuedUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" /> Claim link ready</DialogTitle>
            <DialogDescription>
              Copy this URL now — you will not be able to retrieve it again. Only a hash is stored.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted p-3">
            <code className="flex-1 truncate text-xs">{issuedUrl}</code>
            <Button
              size="sm"
              onClick={() => {
                if (issuedUrl) navigator.clipboard.writeText(issuedUrl);
                toast.success("Copied");
              }}
            >
              <Copy className="mr-1 h-3 w-3" /> Copy
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <RedemptionsDialog offerId={redemptionsFor} onClose={() => setRedemptionsFor(null)} />
    </div>
  );
}

function RedemptionsDialog({ offerId, onClose }: { offerId: string | null; onClose: () => void }) {
  const fn = useServerFn(adminListOfferRedemptions);
  const { data } = useQuery({
    queryKey: ["admin", "plus-offer-redemptions", offerId],
    enabled: !!offerId,
    queryFn: () => fn({ data: { id: offerId as string } }),
  });
  return (
    <Dialog open={!!offerId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Redemptions</DialogTitle>
        </DialogHeader>
        {!data ? (
          <div className="text-sm text-ink-muted">Loading…</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-ink-muted">No claims yet.</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {(data as any[]).map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2">
                      {r.user ? (
                        <div>
                          <div className="text-ink">{r.user.display_name || r.user.username}</div>
                          <div className="text-xs text-ink-muted">@{r.user.username}</div>
                        </div>
                      ) : (
                        <span className="text-ink-muted">Unknown</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-xs text-ink-muted">
                      {new Date(r.redeemed_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
