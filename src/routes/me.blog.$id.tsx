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
import { entityMarkdown, tagKey, invalidateEntityTagCaches, type BlogEntityTag } from "@/lib/blog-entity-tags";
import {
  getMyBlogPost,
  updateMyBlogPost,
  publishMyBlogPost,
  unpublishMyBlogPost,
  deleteMyBlogDraft,
} from "@/lib/blog-member.functions";
import { PlusGate } from "@/components/plus-gate";
import { BlogPublishSuccessDialog, type PublishedPostSummary } from "@/components/blog-publish-success";
import { Switch } from "@/components/ui/switch";
import { generateExcerpt } from "@/lib/blog-excerpt";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MAX_BLOG_ENTITY_TAGS } from "@/lib/blog-entity-tags";
import { ArrowLeft, Loader2, MoreHorizontal } from "lucide-react";

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
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [coverAlt, setCoverAlt] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");
  const [listInBlog, setListInBlog] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const [entityTags, setEntityTags] = useState<BlogEntityTag[]>([]);
  const [entityPickerOpen, setEntityPickerOpen] = useState(false);
  const [pendingInsertRef, setPendingInsertRef] = useState<((md: string) => void) | null>(null);
  const [blogGateOpen, setBlogGateOpen] = useState(false);
  const [published, setPublished] = useState<PublishedPostSummary | null>(null);

  const post = (q.data as { post: EditorPost; entity_tags?: BlogEntityTag[]; access: { canPublish: boolean; canEditExisting: boolean; canUnpublish: boolean; canDeleteNeverPublishedDraft: boolean; reason: string | null; mode: string; publicationsThisMonth: number; monthlyPublicationLimit: number | null } } | undefined);

  useEffect(() => {
    if (!post || loadedForId === post.post.id) return;
    const p = post.post;
    setTitle(p.title);
    setExcerpt(p.excerpt);
    setBody(p.body_markdown);
    setCover(p.cover_image_url);
    setCoverAlt(p.cover_image_alt ?? "");
    setSeoTitle(p.seo_title ?? "");
    setSeoDesc(p.seo_description ?? "");
    setListInBlog(p.show_in_blog_index !== false);
    setEntityTags(post.entity_tags ?? []);
    setDirty(false);
    setLoadedForId(p.id);
  }, [post, loadedForId]);

  function refreshEntityCaches() {
    invalidateEntityTagCaches(qc, entityTags, post?.entity_tags ?? []);
    // Member Home surfaces the author's own posts + the Blog rail.
    qc.invalidateQueries({ queryKey: ["member-home"] });
  }


  const saveMut = useMutation({
    mutationFn: async (opts?: { silent?: boolean }) => {
      await updateFn({
        data: {
          id,
          title,
          excerpt,
          body_markdown: body,
          cover_image_url: cover,
          cover_image_alt: coverAlt || null,
          seo_title: seoTitle || null,
          seo_description: seoDesc || null,
          show_in_blog_index: listInBlog,
          tags: entityTags.map((t) => ({ kind: t.kind, id: t.id })),
          expected_updated_at: post?.post.updated_at,
        },
      });
      return { silent: opts?.silent ?? false };
    },
    onSuccess: (r) => {
      // During a publish the success dialog is the single confirmation.
      if (!r.silent) toast.success("Saved");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["my-blog-post", id] });
      qc.invalidateQueries({ queryKey: ["my-blog-posts", user?.id] });
      refreshEntityCaches();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      await saveMut.mutateAsync({ silent: true });
      return publishFn({ data: { id } });
    },
    onSuccess: (result) => {
      // Always use the slug the server finalized, never local draft state.
      const p = result as unknown as { id: string; slug: string; title: string; excerpt: string | null } | null;
      if (p?.slug) setPublished({ id: p.id, slug: p.slug, title: p.title, excerpt: p.excerpt });
      else toast.success("Published");
      qc.invalidateQueries({ queryKey: ["my-blog-post", id] });
      qc.invalidateQueries({ queryKey: ["my-blog-posts", user?.id] });
      refreshEntityCaches();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const unpublishMut = useMutation({
    mutationFn: () => unpublishFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Unpublished");
      qc.invalidateQueries({ queryKey: ["my-blog-post", id] });
      qc.invalidateQueries({ queryKey: ["my-blog-posts", user?.id] });
      refreshEntityCaches();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Draft deleted");
      qc.invalidateQueries({ queryKey: ["my-blog-posts", user?.id] });
      refreshEntityCaches();
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
  const readOnly = !access.canEditExisting;
  const publishBlockedByQuota = !access.canPublish && (access.mode === "free" || access.mode === "lapsed");
  const nearBlogLimit = access.monthlyPublicationLimit != null && access.publicationsThisMonth === access.monthlyPublicationLimit - 1;
  const canDeleteDraft = !post.post.published_at && access.canDeleteNeverPublishedDraft;
  const showOverflow = isPublished || canDeleteDraft;
  const generatedExcerpt = generateExcerpt(body);
  const effectiveExcerpt = excerpt.trim() || generatedExcerpt;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/me/blog"
          className="inline-flex h-11 shrink-0 items-center gap-1 text-sm text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Your posts
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          {isPublished && (
            <Link
              to="/blog/$slug"
              params={{ slug: post.post.slug }}
              className="inline-flex h-11 shrink-0 items-center rounded-full border border-border px-4 text-sm text-ink-soft hover:bg-muted"
            >
              View live
            </Link>
          )}
          <Button
            variant="outline"
            className="h-11 shrink-0 rounded-full px-4"
            disabled={!dirty || saveMut.isPending || readOnly}
            onClick={() => saveMut.mutate(undefined)}
          >
            {saveMut.isPending ? "Saving…" : "Save"}
          </Button>
          {!isPublished && (
            <Button
              className="h-11 shrink-0 px-5 bg-primary text-primary-foreground"
              disabled={(!access.canPublish && !publishBlockedByQuota) || publishMut.isPending}
              onClick={() => publishBlockedByQuota ? setBlogGateOpen(true) : publishMut.mutate()}
            >
              {publishMut.isPending ? "Publishing…" : "Publish"}
            </Button>
          )}
          {showOverflow && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More post actions"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-ink-soft hover:bg-muted"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isPublished && (
                  <DropdownMenuItem
                    disabled={!access.canUnpublish || unpublishMut.isPending}
                    onSelect={() => unpublishMut.mutate()}
                  >
                    Unpublish
                  </DropdownMenuItem>
                )}
                {canDeleteDraft && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={deleteMut.isPending}
                    onSelect={() => {
                      if (confirm("Delete this draft? This can't be undone.")) deleteMut.mutate();
                    }}
                  >
                    Delete draft
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {access.monthlyPublicationLimit != null && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
            Published <span className="font-medium text-ink">{access.publicationsThisMonth}</span> of {access.monthlyPublicationLimit} this month
          </span>
          {nearBlogLimit && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
              Last free post this month
            </span>
          )}
          {!access.canPublish && (access.mode === "free" || access.mode === "lapsed") && (
            <Link to="/pricing" className="text-primary hover:underline">Go Plus for unlimited</Link>
          )}
        </div>
      )}
      {!access.canPublish && access.reason && !publishBlockedByQuota && (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-3 text-xs text-ink-soft">
          {access.reason}
        </div>
      )}

      <Tabs defaultValue="edit" className="mt-6">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-muted">Title</label>
            <input
              type="text"
              value={title}
              readOnly={readOnly}
              maxLength={160}
              onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
              className="mt-1 w-full rounded-2xl border border-border bg-surface px-4 py-3 font-display text-2xl text-ink focus:border-primary focus:outline-none"
              placeholder="Give your post a title"
            />
            {title.length > 140 && (
              <p className="mt-1 text-right text-[11px] text-ink-muted">{title.length}/160</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-muted">Cover image</label>
            <div className="mt-2">
              <ImageUpload
                value={cover}
                onChange={(url) => {
                  // A new image invalidates the old description.
                  if (url !== cover) setCoverAlt("");
                  setCover(url);
                  setDirty(true);
                }}
                bucket="covers"
                aspect="wide"
                label="Add cover"
              />
            </div>
          </div>

          {/* Connections are post metadata: above the body, never buried under it. */}
          <BlogEntityTagsEditor
            value={entityTags}
            readOnly={readOnly}
            onChange={(next) => { setEntityTags(next); setDirty(true); }}
          />

          <div>
            <BlogBodyEditor
              value={body}
              readOnly={readOnly}
              onChange={(v) => { setBody(v); setDirty(true); }}
              onRequestEntityInsert={(insert) => {
                setPendingInsertRef(() => insert);
                setEntityPickerOpen(true);
              }}
            />
          </div>
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
            {effectiveExcerpt && <p className="mt-3 text-lg text-ink-soft">{effectiveExcerpt}</p>}
            <div className="mt-6">
              <BlogPostBody markdown={body} />
            </div>
          </article>
        </TabsContent>

        <TabsContent value="details" className="mt-4 space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink">List on the public Blog page</div>
              <p className="mt-1 text-[11px] text-ink-muted">
                Off keeps your post live at its own link, but out of the Blog feed and RSS.
              </p>
            </div>
            <Switch
              checked={listInBlog}
              disabled={readOnly}
              onCheckedChange={(v) => { setListInBlog(v); setDirty(true); }}
              className="mt-1 shrink-0"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-muted">Preview text (optional)</label>
            <p className="mt-1 text-[11px] text-ink-muted">
              Generated from the opening of your post when you publish.
            </p>
            <textarea
              value={excerpt}
              readOnly={readOnly}
              onChange={(e) => { setExcerpt(e.target.value); setDirty(true); }}
              rows={2}
              maxLength={320}
              className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-[16px] text-ink focus:border-primary focus:outline-none"
              placeholder={generatedExcerpt || "A one- or two-line summary (shown in listings)"}
            />
          </div>

          {cover && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-ink-muted">Image description (optional)</label>
              <p className="mt-1 text-[11px] text-ink-muted">
                Used by screen readers; the post title is used if left blank.
              </p>
              <input
                type="text"
                value={coverAlt}
                readOnly={readOnly}
                onChange={(e) => { setCoverAlt(e.target.value); setDirty(true); }}
                placeholder="Describe the cover image"
                className="mt-2 h-11 w-full rounded-full border border-border bg-surface px-4 text-[16px] text-ink focus:border-primary focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-muted">SEO title (optional)</label>
            <input
              type="text"
              value={seoTitle}
              readOnly={readOnly}
              maxLength={80}
              onChange={(e) => { setSeoTitle(e.target.value); setDirty(true); }}
              className="mt-1 h-11 w-full rounded-full border border-border bg-surface px-4 text-[16px] text-ink focus:border-primary focus:outline-none"
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
              className="mt-1 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-[16px] text-ink focus:border-primary focus:outline-none"
              placeholder="Defaults to the excerpt"
            />
          </div>
        </TabsContent>
      </Tabs>

      <BlogEntityTagPicker
        open={entityPickerOpen}
        onOpenChange={(v) => { setEntityPickerOpen(v); if (!v) setPendingInsertRef(null); }}
        title={pendingInsertRef ? "Tag something" : "Add a connection"}
        description={
          pendingInsertRef
            ? "Insert an inline link and connect this post to it."
            : "Connect this post to the Work, Collab, Group, Event, or person it is substantially about."
        }
        disabledKeys={pendingInsertRef ? [] : entityTags.map(tagKey)}

        onPick={(tag) => {
          const already = entityTags.some((t) => tagKey(t) === tagKey(tag));
          if (pendingInsertRef) {
            // Inline tagging creates a real reciprocal connection, not just a link.
            pendingInsertRef(entityMarkdown(tag));
            setPendingInsertRef(null);
            if (!already) {
              if (entityTags.length >= MAX_BLOG_ENTITY_TAGS) {
                toast.message(`Linked, but you're at ${MAX_BLOG_ENTITY_TAGS} connections — not added to Connections.`);
              } else {
                setEntityTags([...entityTags, tag]);
              }
            }
            setDirty(true);
          } else if (!already) {
            setEntityTags([...entityTags, tag]);
            setDirty(true);
          }
          setEntityPickerOpen(false);
        }}
      />
      <BlogPublishSuccessDialog
        post={published}
        open={!!published}
        onOpenChange={(v) => { if (!v) setPublished(null); }}
        authorUserId={user?.id}
      />
      <PlusGate
        open={blogGateOpen}
        onOpenChange={setBlogGateOpen}
        reason="blog_limit"
      />
    </main>
  );
}

