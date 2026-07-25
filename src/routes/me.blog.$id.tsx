import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/image-upload";
import { BlogPostBody } from "@/components/blog-post-body";
import { BlogBodyEditor } from "@/components/blog-body-editor";
import { BlogEntityTagsEditor } from "@/components/blog-entity-tags-editor";
import { BlogEntityTagPicker } from "@/components/blog-entity-tag-picker";
import { entityMarkdown, tagKey, type BlogEntityTag } from "@/lib/blog-entity-tags";
import {
  getMyBlogPost,
  updateMyBlogPost,
  publishMyBlogPost,
  unpublishMyBlogPost,
  deleteMyBlogDraft,
} from "@/lib/blog-member.functions";
import { setBlogPostEntityTagsForMember } from "@/lib/blog-entity-tags.functions";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/me/blog/$id")({
  head: () => ({
    meta: [
      { title: "Edit post — Workshop" },
      { name: "description", content: "Draft or edit your Workshop blog post." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MemberBlogEditorPage,
});

type EditorPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body_markdown: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: "draft" | "published";
  publication_type: "editorial" | "member";
  show_in_blog_index: boolean;
  published_at: string | null;
  updated_at: string;
};

function MemberBlogEditorPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getFn = useServerFn(getMyBlogPost);
  const updateFn = useServerFn(updateMyBlogPost);
  const publishFn = useServerFn(publishMyBlogPost);
  const unpublishFn = useServerFn(unpublishMyBlogPost);
  const deleteFn = useServerFn(deleteMyBlogDraft);
  const setEntityTagsFn = useServerFn(setBlogPostEntityTagsForMember);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const q = useQuery({
    queryKey: ["my-blog-post", id],
    enabled: !!user,
    queryFn: () => getFn({ data: { id } }),
    staleTime: 15_000,
  });

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [coverAlt, setCoverAlt] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const [entityTags, setEntityTags] = useState<BlogEntityTag[]>([]);
  const [entityPickerOpen, setEntityPickerOpen] = useState(false);
  const [pendingInsertRef, setPendingInsertRef] = useState<((md: string) => void) | null>(null);

  const post = (q.data as { post: EditorPost; entity_tags?: BlogEntityTag[]; access: { canPublish: boolean; canEditExisting: boolean; canUnpublish: boolean; canDeleteNeverPublishedDraft: boolean; reason: string | null; mode: string } } | undefined);

  useEffect(() => {
    if (!post || loadedForId === post.post.id) return;
    const p = post.post;
    setTitle(p.title);
    setSlug(p.slug);
    setExcerpt(p.excerpt);
    setBody(p.body_markdown);
    setCover(p.cover_image_url);
    setCoverAlt(p.cover_image_alt ?? "");
    setSeoTitle(p.seo_title ?? "");
    setSeoDesc(p.seo_description ?? "");
    setEntityTags(post.entity_tags ?? []);
    setDirty(false);
    setLoadedForId(p.id);
  }, [post, loadedForId]);

  async function flushEntityTags() {
    try {
      await setEntityTagsFn({
        data: { postId: id, tags: entityTags.map((t) => ({ kind: t.kind, id: t.id })) },
      });
    } catch (e) {
      toast.error(`Tags: ${(e as Error).message}`);
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      await updateFn({
        data: {
          id,
          title,
          slug: post?.post.published_at ? undefined : slug,
          excerpt,
          body_markdown: body,
          cover_image_url: cover,
          cover_image_alt: coverAlt || null,
          seo_title: seoTitle || null,
          seo_description: seoDesc || null,
          expected_updated_at: post?.post.updated_at,
        },
      });
      await flushEntityTags();
    },
    onSuccess: () => {
      toast.success("Saved");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["my-blog-post", id] });
      qc.invalidateQueries({ queryKey: ["my-blog-posts", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      if (dirty) await saveMut.mutateAsync();
      return publishFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Published");
      qc.invalidateQueries({ queryKey: ["my-blog-post", id] });
      qc.invalidateQueries({ queryKey: ["my-blog-posts", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unpublishMut = useMutation({
    mutationFn: () => unpublishFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Unpublished");
      qc.invalidateQueries({ queryKey: ["my-blog-post", id] });
      qc.invalidateQueries({ queryKey: ["my-blog-posts", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Draft deleted");
      qc.invalidateQueries({ queryKey: ["my-blog-posts", user?.id] });
      navigate({ to: "/me/blog" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading || !user) return null;
  if (q.isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-ink-muted" />
      </main>
    );
  }
  if (q.error || !post) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <p className="text-ink-muted">Post not found.</p>
        <Link to="/me/blog" className="text-sm text-primary hover:underline">Back to your posts</Link>
      </main>
    );
  }

  const access = post.access;
  const isPublished = post.post.status === "published";
  const slugLocked = !!post.post.published_at;
  const readOnly = !access.canEditExisting;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/me/blog"
          className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Your posts
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {isPublished && (
            <Link
              to="/blog/$slug"
              params={{ slug: post.post.slug }}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-ink-soft hover:bg-muted"
            >
              View live
            </Link>
          )}
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={!dirty || saveMut.isPending || readOnly}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? "Saving…" : "Save"}
          </Button>
          {isPublished ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={!access.canUnpublish || unpublishMut.isPending}
              onClick={() => unpublishMut.mutate()}
            >
              Unpublish
            </Button>
          ) : (
            <Button
              size="sm"
              className="rounded-full gradient-motion text-primary-foreground"
              disabled={!access.canPublish || publishMut.isPending}
              onClick={() => publishMut.mutate()}
            >
              {publishMut.isPending ? "Publishing…" : "Publish"}
            </Button>
          )}
        </div>
      </div>

      {!access.canPublish && access.reason && (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-3 text-xs text-ink-soft">
          {access.reason}
        </div>
      )}

      <Tabs defaultValue="edit" className="mt-6">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-muted">Title</label>
            <input
              type="text"
              value={title}
              readOnly={readOnly}
              onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
              className="mt-1 w-full rounded-2xl border border-border bg-surface px-4 py-3 font-display text-2xl text-ink focus:border-primary focus:outline-none"
              placeholder="Give your post a title"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              URL slug {slugLocked && <span className="text-ink-muted normal-case tracking-normal">— locked after first publish</span>}
            </label>
            <input
              type="text"
              value={slug}
              readOnly={slugLocked || readOnly}
              onChange={(e) => { setSlug(e.target.value); setDirty(true); }}
              className="mt-1 w-full rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink focus:border-primary focus:outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-muted">Excerpt</label>
            <textarea
              value={excerpt}
              readOnly={readOnly}
              onChange={(e) => { setExcerpt(e.target.value); setDirty(true); }}
              rows={2}
              maxLength={320}
              className="mt-1 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink focus:border-primary focus:outline-none"
              placeholder="A one- or two-line summary (shown in listings)"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-muted">Cover image</label>
            <div className="mt-2">
              <ImageUpload
                value={cover}
                onChange={(url) => { setCover(url); setDirty(true); }}
                bucket="covers"
                aspect="wide"
                label="Add cover"
              />
            </div>
            {cover && (
              <input
                type="text"
                value={coverAlt}
                readOnly={readOnly}
                onChange={(e) => { setCoverAlt(e.target.value); setDirty(true); }}
                placeholder="Describe the cover image (required to publish)"
                className="mt-2 w-full rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink focus:border-primary focus:outline-none"
              />
            )}
          </div>

          <div>
            <BlogBodyEditor
              value={body}
              readOnly={readOnly}
              onChange={(v) => { setBody(v); setDirty(true); }}
            />
          </div>


          {!post.post.published_at && access.canDeleteNeverPublishedDraft && (
            <div className="border-t border-border pt-4">
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm("Delete this draft? This can't be undone.")) deleteMut.mutate();
                }}
                disabled={deleteMut.isPending}
              >
                Delete draft
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <article className="prose-workshop">
            {cover && (
              <img
                src={cover}
                alt={coverAlt || title}
                className="mb-6 w-full rounded-3xl border border-border object-cover"
              />
            )}
            <h1 className="font-display text-4xl text-ink">{title || "Untitled"}</h1>
            {excerpt && <p className="mt-3 text-lg text-ink-soft">{excerpt}</p>}
            <div className="mt-6">
              <BlogPostBody markdown={body} />
            </div>
          </article>
        </TabsContent>

        <TabsContent value="seo" className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-muted">SEO title (optional)</label>
            <input
              type="text"
              value={seoTitle}
              readOnly={readOnly}
              maxLength={80}
              onChange={(e) => { setSeoTitle(e.target.value); setDirty(true); }}
              className="mt-1 w-full rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink focus:border-primary focus:outline-none"
              placeholder="Defaults to the post title"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-muted">SEO description (optional)</label>
            <textarea
              value={seoDesc}
              readOnly={readOnly}
              rows={2}
              maxLength={160}
              onChange={(e) => { setSeoDesc(e.target.value); setDirty(true); }}
              className="mt-1 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink focus:border-primary focus:outline-none"
              placeholder="Defaults to the excerpt"
            />
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
