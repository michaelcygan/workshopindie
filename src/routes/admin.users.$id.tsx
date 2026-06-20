import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import {
  getAdminUserDetail, setAdminUserRole, setAdminUserBadge,
  softDeleteAdminUser, forceSignOutAdminUser,
} from "@/lib/admin-users.functions";

export const Route = createFileRoute("/admin/users/$id")({ component: UserDetail });

const STATUSES = ["standard", "founding_creator", "city_host", "verified_creator", "admin"];

function UserDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const detailFn = useServerFn(getAdminUserDetail);
  const roleFn = useServerFn(setAdminUserRole);
  const badgeFn = useServerFn(setAdminUserBadge);
  const delFn = useServerFn(softDeleteAdminUser);
  const signOutFn = useServerFn(forceSignOutAdminUser);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "user", id],
    queryFn: () => detailFn({ data: { userId: id } }),
  });

  const grantRole = useMutation({
    mutationFn: (role: "admin" | "moderator") => roleFn({ data: { userId: id, role, grant: true } }),
    onSuccess: () => { toast.success("Role granted"); qc.invalidateQueries({ queryKey: ["admin", "user", id] }); },
  });
  const revokeRole = useMutation({
    mutationFn: (role: "admin" | "moderator") => roleFn({ data: { userId: id, role, grant: false } }),
    onSuccess: () => { toast.success("Role revoked"); qc.invalidateQueries({ queryKey: ["admin", "user", id] }); },
  });
  const setBadge = useMutation({
    mutationFn: (status: string) => badgeFn({ data: { userId: id, status } }),
    onSuccess: () => { toast.success("Badge updated"); qc.invalidateQueries({ queryKey: ["admin", "user", id] }); },
  });
  const softDelete = useMutation({
    mutationFn: () => delFn({ data: { userId: id } }),
    onSuccess: () => { toast.success("Account marked deleted"); qc.invalidateQueries({ queryKey: ["admin", "user", id] }); },
  });
  const forceOut = useMutation({
    mutationFn: () => signOutFn({ data: { userId: id } }),
    onSuccess: () => toast.success("Signed out everywhere"),
  });

  const [badgeChoice, setBadgeChoice] = useState<string | null>(null);
  if (isLoading) return <div className="text-sm text-ink-muted">Loading…</div>;
  const p = data?.profile as any;
  if (!p) return <div className="text-sm text-ink-muted">User not found.</div>;
  const roles = data!.roles;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-ink">{p.display_name || p.username || id.slice(0, 8)}</h2>
            <div className="mt-1 text-sm text-ink-muted">@{p.username || "—"} · {data?.email ?? "—"}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{p.creator_status}</Badge>
              {roles.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}
              {p.deleted_at ? <Badge className="bg-rose-100 text-rose-700">deleted</Badge> : null}
            </div>
            <div className="mt-3 text-xs text-ink-soft">
              Joined {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"} ·
              Last active {p.last_active_at ? new Date(p.last_active_at).toLocaleDateString() : "—"} ·
              Last sign-in {data?.lastSignInAt ? new Date(data.lastSignInAt).toLocaleString() : "—"}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs">
            <Link to="/u/$username" params={{ username: p.username ?? "" }} className="text-primary hover:underline">View public profile →</Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm sm:grid-cols-7">
          {[
            ["Works", data!.counts.works], ["Collabs", data!.counts.collabs],
            ["Workshops", data!.counts.workshops], ["Wkshp apps", data!.counts.workshopApps],
            ["RSVPs", data!.counts.rsvps], ["Following", data!.counts.following],
            ["Reports filed", data!.counts.reportsFiled],
          ].map(([label, v]) => (
            <div key={label as string} className="rounded-lg bg-muted px-2 py-2">
              <div className="text-lg font-semibold text-ink">{v as number}</div>
              <div className="text-[10px] uppercase tracking-wide text-ink-muted">{label as string}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="mb-3 font-display text-lg text-ink">Actions</h3>
        <div className="flex flex-wrap items-center gap-3">
          {(["admin", "moderator"] as const).map((r) => (
            roles.includes(r) ? (
              <Button key={r} variant="outline" size="sm" onClick={() => revokeRole.mutate(r)} disabled={revokeRole.isPending}>Revoke {r}</Button>
            ) : (
              <Button key={r} variant="secondary" size="sm" onClick={() => grantRole.mutate(r)} disabled={grantRole.isPending}>Grant {r}</Button>
            )
          ))}
          <div className="flex items-center gap-2">
            <Select value={badgeChoice ?? p.creator_status} onValueChange={(v) => setBadgeChoice(v)}>
              <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" onClick={() => badgeChoice && setBadge.mutate(badgeChoice)} disabled={!badgeChoice || setBadge.isPending}>Set badge</Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => forceOut.mutate()} disabled={forceOut.isPending}>Force sign-out</Button>
          <Button variant="destructive" size="sm" onClick={() => { if (confirm("Soft-delete this account? They lose discoverability and are flagged for hard delete.")) softDelete.mutate(); }}>Soft delete</Button>
        </div>
      </div>

      {data?.subscription ? (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="mb-2 font-display text-lg text-ink">Subscription</h3>
          <div className="text-sm text-ink-soft">
            {data.subscription.tier} · {data.subscription.status} · {data.subscription.environment} · ends {data.subscription.current_period_end ? new Date(data.subscription.current_period_end).toLocaleDateString() : "—"}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportTable title="Reports against this user" rows={data!.reportsAgainst} />
        <ReportTable title="Reports filed by this user" rows={data!.reportsBy} />
      </div>
    </div>
  );
}

function ReportTable({ title, rows }: { title: string; rows: any[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="border-b border-border bg-muted/50 px-3 py-2 text-xs uppercase tracking-wide text-ink-muted">{title}</div>
      <table className="w-full text-sm">
        <thead className="text-xs text-ink-muted">
          <tr>
            <th className="px-3 py-2 text-left">Entity</th>
            <th className="px-3 py-2 text-left">Reason</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={4} className="px-3 py-4 text-center text-ink-muted">None.</td></tr>
          ) : rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-3 py-1.5">{r.entity_type}</td>
              <td className="px-3 py-1.5">{r.reason}</td>
              <td className="px-3 py-1.5">{r.status}</td>
              <td className="px-3 py-1.5">{new Date(r.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
