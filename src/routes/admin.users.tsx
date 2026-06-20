import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchAdminUsers } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/admin/users")({ component: UsersPage });

function UsersPage() {
  const fn = useServerFn(searchAdminUsers);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data, mutate, isPending } = useMutation({
    mutationFn: (qq: string) => fn({ data: { q: qq } }),
  });

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); if (q.trim()) mutate(q.trim()); }}
      >
        <Input placeholder="Search by username, display name, or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" disabled={isPending || !q.trim()}>Search</Button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Username</th>
              <th className="px-3 py-2 text-left">Badge</th>
              <th className="px-3 py-2 text-left">Joined</th>
              <th className="px-3 py-2 text-left">Last active</th>
              <th className="px-3 py-2 text-right">Works</th>
              <th className="px-3 py-2 text-right">Followers</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((u: any) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <Link to="/admin/users/$id" params={{ id: u.id }} className="text-primary hover:underline">
                    {u.display_name || u.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-3 py-2 text-ink-soft">{u.username ?? "—"}</td>
                <td className="px-3 py-2">{u.creator_status}</td>
                <td className="px-3 py-2">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2">{u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-2 text-right">{u.work_count ?? 0}</td>
                <td className="px-3 py-2 text-right">{u.follower_count ?? 0}</td>
              </tr>
            ))}
            {!data?.length && !isPending ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-muted">Search for a user above.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
