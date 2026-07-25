import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { adminListPosts } from "@/lib/blog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ExternalLink, Pencil, EyeOff } from "lucide-react";

export const Route = createFileRoute("/admin/blog/")({
  component: AdminBlogIndex,
});

type PubType = "all" | "editorial" | "member";
type Status = "all" | "published" | "draft";
type Vis = "all" | "public" | "hidden";

function AdminBlogIndex() {
  const list = useServerFn(adminListPosts);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-blog-posts"],
    queryFn: () => list(),
  });

  const [pubType, setPubType] = useState<PubType>("all");
  const [status, setStatus] = useState<Status>("all");
  const [vis, setVis] = useState<Vis>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const term = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (pubType !== "all" && (p.publication_type ?? "editorial") !== pubType) return false;
      if (status !== "all" && p.status !== status) return false;
      if (vis === "public" && p.show_in_blog_index === false) return false;
      if (vis === "hidden" && p.show_in_blog_index !== false) return false;
      if (term && !(p.title?.toLowerCase().includes(term) || p.slug?.toLowerCase().includes(term) || p.author_name?.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [data, pubType, status, vis, q]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="font-display text-2xl text-ink">Blog</h2>
          <p className="text-sm text-ink-muted">All posts — editorial and member drafts.</p>
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterChips label="Type" value={pubType} onChange={setPubType} options={[["all","All"],["editorial","Editorial"],["member","Member"]]} />
        <FilterChips label="Status" value={status} onChange={setStatus} options={[["all","All"],["published","Published"],["draft","Draft"]]} />
        <FilterChips label="Visibility" value={vis} onChange={setVis} options={[["all","All"],["public","In index"],["hidden","Profile-only"]]} />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, slug, author…"
          className="ml-auto h-9 max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-ink-muted">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <div className="font-display text-lg text-ink">No matching posts.</div>
          <p className="mt-1 text-sm text-ink-muted">Adjust the filters above or write a new post.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{p.title}</span>
                      {p.show_in_blog_index === false && (
                        <span title="Hidden from public index" className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
                          <EyeOff className="h-3 w-3" /> Hidden
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-muted">/blog/{p.slug} · {p.author_name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-ink-muted">
                      {p.publication_type ?? "editorial"}
                    </span>
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

function FilterChips<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<[T, string]>;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1">
      <span className="px-2 text-[11px] uppercase tracking-wide text-ink-muted">{label}</span>
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-full px-2.5 py-1 text-xs transition ${
            value === v ? "bg-ink text-surface" : "text-ink-soft hover:bg-muted"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
