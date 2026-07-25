import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getMyBlogAccess,
  listMyBlogPosts,
  createMyBlogDraft,
  unpublishMyBlogPost,
  deleteMyBlogDraft,
} from "@/lib/blog-member.functions";
import { PenLine, Plus, ExternalLink, ChevronRight, MoreVertical, Trash2, Loader2 } from "lucide-react";


export const Route = createFileRoute("/me/blog/")({
  head: () => ({
    meta: [
      { title: "Your blog posts — Workshop" },
      { name: "description", content: "Draft and publish articles on Workshop." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyBlogPage,
});

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  status: "draft" | "published";
  publication_type: "editorial" | "member";
  show_in_blog_index: boolean;
  cover_image_url: string | null;
  published_at: string | null;
  updated_at: string;
};

function MyBlogPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const accessFn = useServerFn(getMyBlogAccess);
  const listFn = useServerFn(listMyBlogPosts);
  const createFn = useServerFn(createMyBlogDraft);
  const unpublishFn = useServerFn(unpublishMyBlogPost);
  const deleteFn = useServerFn(deleteMyBlogDraft);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const access = useQuery({
    queryKey: ["my-blog-access", user?.id],
    enabled: !!user,
    queryFn: () => accessFn(),
    staleTime: 60_000,
  });

  const posts = useQuery({
    queryKey: ["my-blog-posts", user?.id],
    enabled: !!user,
    queryFn: () => listFn({ data: { cursor: null, limit: 20 } }),
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: () => createFn(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["my-blog-posts", user?.id] });
      navigate({ to: "/me/blog/$id", params: { id: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [confirmTarget, setConfirmTarget] = useState<Post | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteMut = useMutation({
    mutationFn: async (post: Post) => {
      setDeletingId(post.id);
      if (post.status === "published" || post.published_at) {
        await unpublishFn({ data: { id: post.id } });
      }
      await deleteFn({ data: { id: post.id } });
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["my-blog-posts", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      setDeletingId(null);
      setConfirmTarget(null);
    },
  });


  if (authLoading || !user) return null;

  const acc = access.data;
  const list = ((posts.data as { posts: Post[] } | undefined)?.posts ?? []) as Post[];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink md:text-4xl">Your blog posts</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Notes, essays, and process from your Workshop practice.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/blog">Public blog</Link>
          </Button>
          <Button
            size="sm"
            className="rounded-full gradient-motion text-primary-foreground"
            disabled={!acc?.canCreateDraft || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            <Plus className="mr-1 h-4 w-4" />
            New draft
          </Button>
        </div>
      </div>

      {acc && !acc.canCreateDraft && acc.reason && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-4 text-sm text-ink-soft">
          <p>{acc.reason}</p>
          {acc.mode === "free" || acc.mode === "lapsed" ? (
            <div className="mt-3">
              <Button asChild size="sm" className="rounded-full">
                <Link to="/pricing">See Plus</Link>
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <section className="mt-8">
        {posts.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
            <PenLine className="mx-auto h-6 w-6 text-ink-muted" />
            <p className="mt-3 text-ink-muted">
              You haven't drafted anything yet. Start a post to share what you're working on.
            </p>
            {acc?.canCreateDraft && (
              <Button
                className="mt-4 rounded-full gradient-motion text-primary-foreground"
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending}
              >
                <Plus className="mr-1 h-4 w-4" />
                Start a draft
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {list.map((p) => (
              <li key={p.id}>
                <Link
                  to="/me/blog/$id"
                  params={{ id: p.id }}
                  className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-4 hover:bg-muted transition-colors"
                >
                  {p.cover_image_url ? (
                    <img
                      src={p.cover_image_url}
                      alt=""
                      className="hidden h-16 w-24 shrink-0 rounded-lg object-cover sm:block"
                      loading="lazy"
                    />
                  ) : (
                    <div className="hidden h-16 w-24 shrink-0 rounded-lg gradient-motion sm:block" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base text-ink group-hover:underline md:text-lg">
                        {p.title || "Untitled draft"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                          p.status === "published"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-ink-muted"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                    {p.excerpt && (
                      <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{p.excerpt}</p>
                    )}
                    <div className="mt-1 text-[11px] text-ink-muted">
                      Updated {new Date(p.updated_at).toLocaleDateString()}
                      {p.published_at && (
                        <> · Published {new Date(p.published_at).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 self-center">
                    {p.status === "published" && (
                      <Link
                        to="/blog/$slug"
                        params={{ slug: p.slug }}
                        onClick={(e) => e.stopPropagation()}
                        className="hidden items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-ink-soft hover:bg-background md:inline-flex"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                    <ChevronRight className="h-5 w-5 text-ink-muted" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
