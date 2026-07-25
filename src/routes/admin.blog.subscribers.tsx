import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminListSubscribers, adminExportSubscribersCsv } from "@/lib/newsletter.functions";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/admin/blog/subscribers")({
  component: SubscribersPage,
});

function SubscribersPage() {
  const list = useServerFn(adminListSubscribers);
  const exp = useServerFn(adminExportSubscribersCsv);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-newsletter-subscribers"],
    queryFn: () => list(),
  });

  async function download() {
    const res = await exp();
    const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workshop-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <Link to="/admin/blog" className="text-sm text-ink-muted hover:text-ink">← Blog</Link>
          <h2 className="mt-1 font-display text-2xl text-ink">Subscribers</h2>
          <p className="text-sm text-ink-muted">
            {data ? `${data.active} active · ${data.total} total` : "Loading…"}
          </p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={download}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Subscribed</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="px-4 py-6 text-ink-muted" colSpan={4}>Loading…</td></tr>
            ) : (data?.rows.length ?? 0) === 0 ? (
              <tr><td className="px-4 py-6 text-ink-muted" colSpan={4}>No subscribers yet.</td></tr>
            ) : (
              data!.rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 text-ink">{r.email}</td>
                  <td className="px-4 py-3 text-ink-muted">{new Date(r.subscribed_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-ink-muted">{r.source}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                      r.status === "subscribed" ? "bg-primary/10 text-primary" : "bg-muted text-ink-muted"
                    }`}>{r.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
