import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/image-upload";
import { BlogPostBody } from "@/components/blog-post-body";
import { BlogBodyEditor } from "@/components/blog-body-editor";
import { BlogAboutEditor } from "@/components/blog-about-editor";
import { BlogPostContext } from "@/components/blog-post-context";
import { deriveBlogPostContext } from "@/lib/blog-post-context";
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
import { BlogComposerWalkthrough } from "@/components/nudges/blog-composer-walkthrough";
import { FloatingSaveDock } from "@/components/blog/floating-save-dock";


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
import { blogCategorySlugForField, blogPostFields } from "@/lib/blog-categories";
import type { FieldId } from "@/lib/taxonomy";
import { type BlogStoryType } from "@/lib/blog-story-types";
import {
  buildBlogTaxonomyPayload,
  hydrateBlogTaxonomy,
  type BlogTaxonomyState,
} from "@/lib/blog-form";

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
  category_slug: string | null;
  fields: string[] | null;
  subjects: string[] | null;
  subcategories: string[] | null;
  story_type: string | null;
  story_types: string[] | null;
  published_at: string | null;
  updated_at: string;
};

type EditorPostPayload = {
  post: EditorPost;
  entity_tags?: BlogEntityTag[];
  access: {
    canPublish: boolean;
    canEditExisting: boolean;
    canUnpublish: boolean;
    canDeleteNeverPublishedDraft: boolean;
    reason: string | null;
    mode: string;
    publicationsThisMonth: number;
    monthlyPublicationLimit: number | null;
  };
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
  const [fields, setFields] = useState<FieldId[]>(["other"]);
  const [postType, setPostType] = useState<BlogStoryType | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [topics, setTopics] = useState<PickerTopic[]>([]);
  const [topicsLoadedForId, setTopicsLoadedForId] = useState<string | null>(null);
  /** Hydration snapshot: legacy values and the Post type the row loaded with. */
  const legacy = useRef<BlogTaxonomyState>(hydrateBlogTaxonomy(null));
  const [dirty, setDirty] = useState(false);
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const [entityTags, setEntityTags] = useState<BlogEntityTag[]>([]);
  const [entityPickerOpen, setEntityPickerOpen] = useState(false);
  const [pendingInsertRef, setPendingInsertRef] = useState<((md: string) => void) | null>(null);
  const [blogGateOpen, setBlogGateOpen] = useState(false);
  const [published, setPublished] = useState<PublishedPostSummary | null>(null);
  /** True while the body composer has a dialog open or an upload in flight. */
  const [composerBusy, setComposerBusy] = useState(false);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error" | "paused">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  /** Optimistic-concurrency token, kept fresh across repeated silent saves. */
  const expectedUpdatedAt = useRef<string | undefined>(undefined);
  const topActionsRef = useRef<HTMLDivElement | null>(null);
  const bottomActionsRef = useRef<HTMLDivElement | null>(null);
  const detailsActionsRef = useRef<HTMLDivElement | null>(null);
  const saveAnchors = useMemo(
    () => [topActionsRef, bottomActionsRef, detailsActionsRef],
    [],
  );

  const post = (q.data as EditorPostPayload | undefined);


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
    const hydrated = hydrateBlogTaxonomy(p);
    legacy.current = hydrated;
    setFields(hydrated.fields);
    setPostType(hydrated.postType);
    setSubjects(hydrated.subjects);
    setEntityTags(post.entity_tags ?? []);
    setDirty(false);
    expectedUpdatedAt.current = p.updated_at;
    setLoadedForId(p.id);
  }, [post, loadedForId]);

  // Hydrate canonical Topics for this post.
  useEffect(() => {
    const postId = post?.post.id;
    if (!postId || topicsLoadedForId === postId) return;
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("blog_post_topics")
        .select("topic_id")
        .eq("post_id", postId);
      const ids = (rows ?? []).map((r) => r.topic_id as string);
      if (ids.length > 0) {
        try {
          const list = await topicsByIdList({ data: { ids } });
          if (!cancelled) {
            setTopics(list as PickerTopic[]);
            setSubjects((list as PickerTopic[]).map((t) => t.name));
          }
        } catch {
          /* keep legacy subjects */
        }
      }
      if (!cancelled) setTopicsLoadedForId(postId);
    })();
    return () => {
      cancelled = true;
    };
  }, [post?.post.id, topicsLoadedForId]);

  // Keep the concurrency token fresh when the query refetches on its own.
  useEffect(() => {
    if (post && loadedForId === post.post.id && !saveMut.isPending && !dirty) {
      expectedUpdatedAt.current = post.post.updated_at;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.post.updated_at]);

  function refreshEntityCaches() {
    invalidateEntityTagCaches(qc, entityTags, post?.entity_tags ?? []);
    // Member Home surfaces the author's own posts + the Blog rail.
    qc.invalidateQueries({ queryKey: ["member-home"] });
  }


  const saveMut = useMutation({
    mutationFn: async (opts?: { silent?: boolean; auto?: boolean }) => {
      const result = await updateFn({
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
          ...buildBlogTaxonomyPayload(
            {
              postType,
              fields,
              subjects,
              legacyStoryTypes: legacy.current.legacyStoryTypes,
              legacySubcategories: legacy.current.legacySubcategories,
            },
            legacy.current.postType,
          ),
          tags: entityTags.map((t) => ({ kind: t.kind, id: t.id })),
          expected_updated_at: expectedUpdatedAt.current,
        },
      });
      try {
        await setEntityTopics({
          data: { kind: "post", entityId: id, topicIds: topics.map((t) => t.id) },
        });
      } catch {
        // Topics never block a save.
      }

      return {
        silent: opts?.silent ?? false,
        auto: opts?.auto ?? false,
        updated_at: (result as { updated_at?: string } | null)?.updated_at,
      };
    },
    onSuccess: (r) => {
      // During a publish the success dialog is the single confirmation.
      if (!r.silent && !r.auto) toast.success("Saved");
      // Adopt the server's new timestamp so the next save doesn't self-conflict.
      if (r.updated_at) expectedUpdatedAt.current = r.updated_at;
      setDirty(false);
      setLastSavedAt(new Date());
      setAutosaveState("saved");
      qc.invalidateQueries({ queryKey: ["my-blog-post", id] });
      qc.invalidateQueries({ queryKey: ["my-blog-posts", user?.id] });
      refreshEntityCaches();
    },
    onError: (e: Error, vars) => {
      const conflict = /another window/i.test(e.message);
      if (vars?.auto) {
        // A conflict means a second tab owns the post — stop autosaving entirely.
        setAutosaveState(conflict ? "paused" : "error");
        if (conflict) toast.error(e.message);
      } else {
        setAutosaveState("error");
        toast.error(e.message);
      }
    },
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


  // Autosave: drafts only. A live post never changes under readers without an
  // explicit Save. Paused states (conflict) stay paused until reload.
  const autosaveEnabled =
    !!post &&
    post.post.status !== "published" &&
    post.access.canEditExisting &&
    autosaveState !== "paused";
  const saveRef = useRef(saveMut);
  saveRef.current = saveMut;
  const autosaveReady = autosaveEnabled && dirty && !composerBusy && !saveMut.isPending;

  useEffect(() => {
    if (!autosaveReady) return;
    const t = setTimeout(() => {
      setAutosaveState("saving");
      saveRef.current.mutate({ silent: true, auto: true });
    }, 2500);
    return () => clearTimeout(t);
  }, [autosaveReady, title, excerpt, body, cover, coverAlt, seoTitle, seoDesc, listInBlog, fields, postType, subjects, topics, entityTags]);

  // Flush pending edits when the tab is hidden or the window loses focus.
  useEffect(() => {
    if (!autosaveEnabled) return;
    const flush = () => {
      if (!dirty || composerBusy || saveRef.current.isPending) return;
      setAutosaveState("saving");
      saveRef.current.mutate({ silent: true, auto: true });
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("blur", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [autosaveEnabled, dirty, composerBusy]);

  // Warn before leaving with unsaved edits that autosave will not pick up.
  useEffect(() => {
    if (!dirty) return;
    if (autosaveEnabled && autosaveState !== "error") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, autosaveEnabled, autosaveState]);

  const saveStatus = (() => {
    if (saveMut.isPending || autosaveState === "saving") return "Saving…";
    if (autosaveState === "paused") return "Paused — reload to continue";
    if (autosaveState === "error") return "Couldn't autosave — press Save";
    if (dirty) return "Unsaved changes";
    if (lastSavedAt) {
      return `Saved ${lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    }
    return null;
  })();

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

  function PostActions({ post }: { post: EditorPostPayload }) {
    return (
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
        {saveStatus && (
          <span className="hidden shrink-0 text-xs text-ink-muted sm:inline" aria-live="polite">
            {saveStatus}
          </span>
        )}
        <Button
          variant="outline"
          className="h-11 shrink-0 rounded-md px-4"
          disabled={!dirty || saveMut.isPending || readOnly}
          onClick={() => saveMut.mutate(undefined)}
          title={isPublished ? "Live post — changes save when you press Save." : undefined}
        >
          {saveMut.isPending ? "Saving…" : "Save"}
        </Button>

        {!isPublished && (
          <Button
            className="h-11 shrink-0 px-5 bg-primary text-primary-foreground"
            disabled={(!access.canPublish && !publishBlockedByQuota) || publishMut.isPending}
            onClick={() => (publishBlockedByQuota ? setBlogGateOpen(true) : publishMut.mutate())}
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
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/me/blog"
          className="inline-flex h-11 shrink-0 items-center gap-1 text-sm text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Your posts
        </Link>
        <div ref={topActionsRef} className="flex min-w-0 items-center gap-2">
          <PostActions post={post} />
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

          {/* "About this post" — the authoring twin of the public colophon. */}
          <BlogAboutEditor
            postId={post.post.id}
            fields={fields}
            postType={postType}
            onChangePostType={(next) => { setPostType(next); setDirty(true); }}
            subjects={subjects}
            topics={topics}
            onChangeTopics={(next) => {
              setTopics(next);
              setSubjects(next.map((t) => t.name));
              setDirty(true);
            }}
            tags={entityTags}
            readOnly={readOnly}
            onChangeFields={(next) => { setFields(next.length ? next : ["other"]); setDirty(true); }}
            onChangeTags={(next) => { setEntityTags(next); setDirty(true); }}
          />


          <div>
            <BlogBodyEditor
              value={body}
              readOnly={readOnly}
              onChange={(v) => { setBody(v); setDirty(true); }}
              onBusyChange={setComposerBusy}
              onRequestEntityInsert={(insert) => {
                setPendingInsertRef(() => insert);
                setEntityPickerOpen(true);
              }}
            />

          </div>

          <div ref={bottomActionsRef} className="flex items-center justify-end border-t border-border pt-4">
            <PostActions post={post} />
          </div>

        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <article className="prose-workshop">
            {cover && (
              <img
                src={cover}
                alt={coverAlt || title}
                className="mb-6 w-full rounded-xl border border-border object-cover"
              />
            )}
            <h1 className="font-display text-4xl text-ink">{title || "Untitled"}</h1>
            {effectiveExcerpt && <p className="mt-3 text-lg text-ink-soft">{effectiveExcerpt}</p>}
            <div className="mt-6">
              <BlogPostBody markdown={body} />
            </div>
            <BlogPostContext
              context={deriveBlogPostContext({
                storyType: postType,
                fields,
                subjects,
                categorySlug: blogCategorySlugForField(fields[0]),
                tags: entityTags,
              })}
              className="mt-10"
            />
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

          <div ref={detailsActionsRef} className="flex items-center justify-end border-t border-border pt-4">
            <PostActions post={post} />
          </div>
        </TabsContent>
      </Tabs>

      <FloatingSaveDock
        anchors={saveAnchors}
        onSave={() => saveMut.mutate(undefined)}
        disabled={!dirty || saveMut.isPending || readOnly}
        saving={saveMut.isPending}
        status={saveStatus}
      />


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
        excludeKeys={[`post:${post.post.id}`]}

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
      <BlogComposerWalkthrough />

    </main>
  );
}

