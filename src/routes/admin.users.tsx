import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listAdminUsers, listAdminUserCities, type AdminUserFilters } from "@/lib/admin-users.functions";
import { SectionHeading } from "@/components/admin/metric";
import { fmtNumber } from "@/lib/analytics";

export const Route = createFileRoute("/admin/users")({ component: UsersPage });

const SORTS: { id: NonNullable<AdminUserFilters["sort"]>; label: string }[] = [
  { id: "recent", label: "Newest" },
  { id: "last_active", label: "Last active" },
  { id: "works", label: "Most works" },
  { id: "followers", label: "Most followers" },
];

function UsersPage() {
  const fn = useServerFn(listAdminUsers);
  const citiesFn = useServerFn(listAdminUserCities);

  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<AdminUserFilters>({ sort: "recent", page: 1, pageSize: 25, activated: "any", plus: "any", role: "any" });

  const effective = useMemo<AdminUserFilters>(() => ({ ...filters, q: search || undefined }), [filters, search]);

  const { data, isFetching } = useQuery({
    queryKey: ["admin", "users", effective],
    queryFn: () => fn({ data: effective }),
    placeholderData: (prev) => prev,
  });
  const { data: cities } = useQuery({ queryKey: ["admin", "user-cities"], queryFn: () => citiesFn() });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? 1;
  const pageSize = data?.pageSize ?? 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const set = (patch: Partial<AdminUserFilters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  return (
    <div className="space-y-4">
      <SectionHeading
        title="People"
        hint={`${fmtNumber(total)} member${total === 1 ? "" : "s"} match the current filters.`}
      />

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
          set({ page: 1 });
        }}
      >
        <Input className="max-w-xs" placeholder="Search name, username or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="secondary">Search</Button>
        {search ? (
          <Button type="button" variant="ghost" onClick={() => { setQ(""); setSearch(""); }}>Clear</Button>
        ) : null}
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          className="rounded-full border border-border bg-surface px-3 py-1.5"
          value={filters.cityId ?? ""}
          onChange={(e) => set({ cityId: e.target.value || null })}
        >
          <option value="">All cities</option>
          {(cities ?? []).map((c: any) => (
            <option key={c.id} value={c.id}>{c.label} ({c.members})</option>
          ))}
        </select>
        <select className="rounded-full border border-border bg-surface px-3 py-1.5" value={filters.activated} onChange={(e) => set({ activated: e.target.value as any })}>
          <option value="any">Activation: any</option>
          <option value="yes">Activated</option>
          <option value="no">Not activated</option>
        </select>
        <select className="rounded-full border border-border bg-surface px-3 py-1.5" value={filters.plus} onChange={(e) => set({ plus: e.target.value as any })}>
          <option value="any">Plan: any</option>
          <option value="yes">Plus</option>
          <option value="no">Free</option>
        </select>
        <select className="rounded-full border border-border bg-surface px-3 py-1.5" value={filters.role} onChange={(e) => set({ role: e.target.value as any })}>
          <option value="any">Role: any</option>
          <option value="admin">Admins</option>
          <option value="moderator">Moderators</option>
        </select>
        <select
          className="rounded-full border border-border bg-surface px-3 py-1.5"
          value={filters.joinedWithinDays ?? ""}
          onChange={(e) => set({ joinedWithinDays: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Joined: any time</option>
          <option value="7">Joined last 7d</option>
          <option value="30">Joined last 30d</option>
          <option value="90">Joined last 90d</option>
        </select>
        <select
          className="rounded-full border border-border bg-surface px-3 py-1.5"
          value={filters.activeWithinDays ?? ""}
          onChange={(e) => set({ activeWithinDays: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Active: any time</option>
          <option value="7">Active last 7d</option>
          <option value="30">Active last 30d</option>
        </select>
        <select className="rounded-full border border-border bg-surface px-3 py-1.5" value={filters.sort} onChange={(e) => set({ sort: e.target.value as any })}>
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-ink-soft">
          <input type="checkbox" checked={!!filters.includeExcluded} onChange={(e) => set({ includeExcluded: e.target.checked })} />
          Show analytics-excluded
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left">Member</th>
              <th className="px-3 py-2 text-left">City</th>
              <th className="px-3 py-2 text-left">Joined</th>
              <th className="px-3 py-2 text-left">Last active</th>
              <th className="px-3 py-2 text-left">Activation</th>
              <th className="px-3 py-2 text-left">Plan</th>
              <th className="px-3 py-2 text-right">Works</th>
              <th className="px-3 py-2 text-right">Followers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u: any) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <Link to="/admin/users/$id" params={{ id: u.id }} className="text-primary hover:underline">
                    {u.display_name || u.username || u.id.slice(0, 8)}
                  </Link>
                  <div className="flex flex-wrap gap-1 text-[11px] text-ink-muted">
                    {u.username ? <span>@{u.username}</span> : null}
                    {u.roles?.map((r: string) => (
                      <span key={r} className="rounded-full bg-muted px-1.5 uppercase">{r}</span>
                    ))}
                    {u.analytics_excluded ? <span className="rounded-full bg-muted px-1.5 uppercase">excluded</span> : null}
                    {u.deleted_at ? <span className="rounded-full bg-muted px-1.5 uppercase">deleted</span> : null}
                  </div>
                </td>
                <td className="px-3 py-2 text-ink-soft">{u.city_name ?? "—"}</td>
                <td className="px-3 py-2 text-ink-soft">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-ink-soft">{u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-2">
                  {u.activated ? (
                    <span title={`First action: ${u.first_action_surface ?? "—"}`}>Activated</span>
                  ) : u.onboarded ? (
                    <span className="text-ink-muted">Onboarded only</span>
                  ) : (
                    <span className="text-ink-muted">Signed up</span>
                  )}
                </td>
                <td className="px-3 py-2">{u.is_plus ? "Plus" : "Free"}</td>
                <td className="px-3 py-2 text-right">{fmtNumber(u.work_count ?? 0)}</td>
                <td className="px-3 py-2 text-right">{fmtNumber(u.follower_count ?? 0)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-ink-muted">
                  {isFetching ? "Loading…" : "No members match these filters."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-ink-soft">
        <span>Page {page} of {pages}</span>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setFilters((f) => ({ ...f, page: page - 1 }))}>Previous</Button>
          <Button variant="secondary" disabled={page >= pages} onClick={() => setFilters((f) => ({ ...f, page: page + 1 }))}>Next</Button>
        </div>
      </div>
    </div>
  );
}
