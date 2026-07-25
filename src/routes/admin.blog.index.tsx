import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminListPosts } from "@/lib/blog.functions";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink, Pencil } from "lucide-react";

export const Route = createFileRoute("/admin/blog/")({
  component: AdminBlogIndex,
});

function AdminBlogIndex() {
  const list = useServerFn(adminListPosts);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-blog-posts"],
    queryFn: () => list(),
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="font-display text-2xl text-ink">Blog</h2>
          <p className="text-sm text-ink-muted">Editorial posts published at /blog.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/blog/subscribers">
            <Button variant="outline" size="sm" className="rounded-full">Subscribers</Button>
          </Link>
          <Link to="/admin/blog/new">
            <Button size="sm" className="rounded-full gap-1.5">
              <Plus className="h-4 w-4" /> New post
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-ink-muted">Loading…</div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <div className="font-display text-lg text-ink">No posts yet.</div>
          <p className="mt-1 text-sm text-ink-muted">Write your first note.</p>
          <div className="mt-4">
            <Link to="/admin/blog/new">
              <Button size="sm" className="rounded-full gap-1.5">
                <Plus className="h-4 w-4" /> New post
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{p.title}</div>
                    <div className="text-xs text-ink-muted">/blog/{p.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                      p.status === "published" ? "bg-primary/10 text-primary" : "bg-muted text-ink-muted"
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {p.published_at ? new Date(p.published_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(p.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {p.status === "published" && (
                        <Link
                          to="/blog/$slug"
                          params={{ slug: p.slug }}
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs text-ink-soft hover:bg-muted"
                        >
                          <ExternalLink className="h-3 w-3" /> Open
                        </Link>
                      )}
                      <Link
                        to="/admin/blog/$id"
                        params={{ id: p.id }}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs text-ink hover:bg-muted"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
