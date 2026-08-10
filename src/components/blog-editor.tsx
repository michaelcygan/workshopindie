import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/image-upload";
import { BlogPostBody } from "@/components/blog-post-body";
import {
  adminCreateDraft, adminUpdatePost, adminPublishPost, adminUnpublishPost, adminDeleteDraft,
  adminListAuthorProfiles, adminSearchAuthorProfiles, adminSetPostAuthors,
} from "@/lib/blog.functions";
import { setBlogPostEntityTagsForAdmin } from "@/lib/blog-entity-tags.functions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { BlogBodyEditor } from "@/components/blog-body-editor";
import { BlogAboutEditor } from "@/components/blog-about-editor";
import { BlogEntityTagPicker } from "@/components/blog-entity-tag-picker";
import { entityMarkdown, tagKey, invalidateEntityTagCaches, type BlogEntityTag } from "@/lib/blog-entity-tags";
import { blogCategorySlugForField, blogPostFields, type BlogCategorySlug } from "@/lib/blog-categories";
import { fieldLabel, type FieldId } from "@/lib/taxonomy";
import { CategoryPlaceholder } from "@/components/home/category-placeholder";

import { BlogPostContext } from "@/components/blog-post-context";
import { deriveBlogPostContext } from "@/lib/blog-post-context";
import { workshopEntityUrl } from "@/lib/entities/kinds";

const SITE = "https://workshopindie.com";

export type BlogEditorInitial = {
  id?: string;
  title?: string;
  slug?: string;
  excerpt?: string;
  body_markdown?: string;
  cover_image_url?: string | null;
  cover_image_alt?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  author_name?: string;
  category_slug?: string | null;
  fields?: string[] | null;
  author_profile?: { username: string | null } | null;
  status?: "draft" | "published";
  published_at?: string | null;
  authors?: Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null; role_label: string | null }>;
  entity_tags?: BlogEntityTag[];
};

type AttribAuthor = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; role_label: string };

export function BlogEditor({ initial }: { initial?: BlogEditorInitial }) {
  const navigate = useNavigate();
  const isNew = !initial?.id;
  const isPublished = initial?.status === "published";
  const everPublished = !!initial?.published_at;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [body, setBody] = useState(initial?.body_markdown ?? "");
  const [cover, setCover] = useState<string | null>(initial?.cover_image_url ?? null);
  const [coverAlt, setCoverAlt] = useState(initial?.cover_image_alt ?? "");
  const [seoTitle, setSeoTitle] = useState(initial?.seo_title ?? "");
  const [seoDesc, setSeoDesc] = useState(initial?.seo_description ?? "");
  const [authorName, setAuthorName] = useState(initial?.author_name ?? "Workshop");
  const [fields, setFields] = useState<FieldId[]>(
    blogPostFields(initial?.fields, initial?.category_slug).length > 0
      ? blogPostFields(initial?.fields, initial?.category_slug)
      : ["other"],
  );
  const categorySlug: BlogCategorySlug = blogCategorySlugForField(fields[0]);
  const [authorProfileUsername, setAuthorProfileUsername] = useState(initial?.author_profile?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [attribAuthors, setAttribAuthors] = useState<AttribAuthor[]>(
    (initial?.authors ?? []).map((a) => ({
      id: a.id,
      username: a.username,
      display_name: a.display_name,
      avatar_url: a.avatar_url,
      role_label: a.role_label ?? "",
    })),
  );
  const [authorSearch, setAuthorSearch] = useState("");
  const [entityTags, setEntityTags] = useState<BlogEntityTag[]>(initial?.entity_tags ?? []);
  const [entityPickerOpen, setEntityPickerOpen] = useState(false);
  const [pendingInsertRef, setPendingInsertRef] = useState<((md: string) => void) | null>(null);
  

  const create = useServerFn(adminCreateDraft);
  const update = useServerFn(adminUpdatePost);
  const publish = useServerFn(adminPublishPost);
  const unpublish = useServerFn(adminUnpublishPost);
  const del = useServerFn(adminDeleteDraft);
  const setEntityTagsFn = useServerFn(setBlogPostEntityTagsForAdmin);
  const qc = useQueryClient();
  const listAuthorProfiles = useServerFn(adminListAuthorProfiles);
  const { data: authorProfiles } = useQuery({
    queryKey: ["admin-blog-author-profiles"],
    queryFn: () => listAuthorProfiles(),
    staleTime: 5 * 60_000,
  });

  const searchAuthors = useServerFn(adminSearchAuthorProfiles);
  const setPostAuthors = useServerFn(adminSetPostAuthors);
  const { data: searchResults } = useQuery({
    queryKey: ["admin-blog-author-search", authorSearch.trim()],
    queryFn: () => searchAuthors({ data: { q: authorSearch.trim() } }),
    enabled: authorSearch.trim().length > 0,
    staleTime: 30_000,
  });

  useEffect(() => { setDirty(true); }, [title, slug, excerpt, body, cover, coverAlt, seoTitle, seoDesc, authorName, authorProfileUsername, attribAuthors]);
  useEffect(() => { setDirty(false); }, [initial?.id]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const wordCount = useMemo(() => (body.trim().match(/\S+/g)?.length ?? 0), [body]);
  const readingMin = Math.max(1, Math.round(wordCount / 220));

  const effTitle = (seoTitle?.trim() || title).slice(0, 80);
  const effDesc = (seoDesc?.trim() || excerpt).slice(0, 160);
  const effUrl = `${SITE}${workshopEntityUrl({ kind: "post", slug: slug || "your-slug" })}`;


  async function flushAuthors(postId: string) {
    // Author failures must fail the save — never report success with authors dropped.
    try {
      await setPostAuthors({
        data: {
          post_id: postId,
          authors: attribAuthors.map((a) => ({
            profile_id: a.id,
            role_label: a.role_label.trim() ? a.role_label.trim() : null,
          })),
        },
      });
    } catch (e) {
      throw new Error(`Attributed profiles: ${(e as Error).message}`);
    }
  }

  async function flushEntityTags(postId: string) {
    // Connection failures must fail the save — never report success with connections dropped.
    try {
      await setEntityTagsFn({
        data: {
          postId,
          tags: entityTags.map((t) => ({ kind: t.kind, id: t.id })),
        },
      });
    } catch (e) {
      throw new Error(`Connections: ${(e as Error).message}`);
    }
    invalidateEntityTagCaches(qc, entityTags, initial?.entity_tags ?? []);
  }

  /** Throws on any failure. Only clears dirty state when every step succeeded. */
  async function runSave(): Promise<{ id: string }> {
    if (!title.trim()) throw new Error("Title is required.");
    setSaving(true);
    try {
      if (isNew) {
        const res = await create({ data: buildPayload() });
        await flushAuthors(res.id);
        await flushEntityTags(res.id);
        setDirty(false);
        return { id: res.id };
      }
      const id = initial!.id!;
      await update({ data: { id, ...buildPayload(), slug: everPublished ? undefined : slug } });
      await flushAuthors(id);
      await flushEntityTags(id);
      setDirty(false);
      return { id };
    } finally {
      setSaving(false);
    }
  }

  async function onSave() {
    try {
      const res = await runSave();
      if (isNew) {
        toast.success("Draft saved.");
        navigate({ to: "/admin/blog/$id", params: { id: res.id } });
      } else {
        toast.success("Saved.");
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function buildPayload() {
    return {
      title: title.trim(),
      slug: slug.trim() || undefined,
      excerpt: excerpt.trim(),
      body_markdown: body,
      cover_image_url: cover,
      cover_image_alt: coverAlt.trim() || null,
      seo_title: seoTitle.trim() || null,
      seo_description: seoDesc.trim() || null,
      author_name: authorName.trim() || "Workshop",
      author_profile_username: authorProfileUsername.trim().replace(/^@/, "") || null,
      category_slug: categorySlug,
      fields,
    };
  }

  async function onPublish() {
    try {
      if (!initial?.id) {
        const res = await runSave();
        toast.success("Draft saved.");
        navigate({ to: "/admin/blog/$id", params: { id: res.id } });
        return;
      }
      if (dirty) await runSave();
      await publish({ data: { id: initial.id } });
      toast.success("Published.");
      navigate({ to: "/admin/blog" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }


  async function onUnpublish() {
    if (!initial?.id) return;
    try {
      await unpublish({ data: { id: initial.id } });
      toast.success("Unpublished — now a draft.");
      navigate({ to: "/admin/blog" });
    } catch (e) { toast.error((e as Error).message); }
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!confirm("Delete this draft permanently?")) return;
    try {
      await del({ data: { id: initial.id } });
      toast.success("Draft deleted.");
      navigate({ to: "/admin/blog" });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link to="/admin/blog" className="text-sm text-ink-muted hover:text-ink">← Blog</Link>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-md" onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save draft"}
            </Button>
            {isPublished ? (
              <Button variant="outline" size="sm" className="rounded-md" onClick={onUnpublish}>Unpublish</Button>
            ) : (
              <Button size="sm" className="rounded-md" onClick={onPublish}>{everPublished ? "Republish" : "Publish"}</Button>
            )}
            {isPublished && (
              <Link to="/blog/$slug" params={{ slug: initial!.slug! }} target="_blank">
                <Button variant="ghost" size="sm" className="rounded-md">View</Button>
              </Link>
            )}
            {!everPublished && !isNew && (
              <Button variant="ghost" size="sm" className="rounded-md text-destructive" onClick={onDelete}>Delete</Button>
            )}
          </div>
        </div>

        <label className="block text-xs font-medium uppercase tracking-wider text-ink-muted">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A short, human title"
          maxLength={160}
          className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-3 font-display text-2xl text-ink focus:border-primary focus:outline-none"
        />
        <div className="mt-1 text-[11px] text-ink-muted">{title.length}/160</div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-ink-muted">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={everPublished}
              placeholder="auto-from-title"
              maxLength={120}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-sm text-ink focus:border-primary focus:outline-none disabled:opacity-60"
            />
            <div className="mt-1 truncate text-[11px] text-ink-muted">
              {effUrl} {everPublished && "· locked after publish"}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-ink-muted">Profile link</label>
            <input
              value={authorProfileUsername}
              onChange={(event) => setAuthorProfileUsername(event.target.value)}
              list="blog-author-profiles"
              placeholder="@username (optional)"
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
            />
            <datalist id="blog-author-profiles">
              {(authorProfiles ?? []).map((profile) => (
                <option key={profile.id} value={profile.username ?? ""}>
                  {profile.display_name ?? profile.username}
                </option>
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-ink-muted">Author</label>
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
            />
          </div>
          {/* Category lives in the "About this post" panel below. */}

        </div>

        <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium uppercase tracking-wider text-ink-muted">
              Attributed profiles
            </label>
            <span className="text-[11px] text-ink-muted">Shows this post on each profile's Blog tab</span>
          </div>

          {attribAuthors.length > 0 && (
            <ul className="mt-3 space-y-2">
              {attribAuthors.map((a, i) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-2 py-1.5">
                  <Avatar className="h-6 w-6">
                    {a.avatar_url ? <AvatarImage src={a.avatar_url} alt="" /> : null}
                    <AvatarFallback className="text-[10px]">{(a.display_name ?? a.username ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-ink">{a.display_name ?? a.username}</div>
                    {a.username && <div className="truncate text-[11px] text-ink-muted">@{a.username}</div>}
                  </div>
                  <input
                    value={a.role_label}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAttribAuthors((prev) => prev.map((row, idx) => (idx === i ? { ...row, role_label: val } : row)));
                    }}
                    placeholder="Role (optional)"
                    maxLength={60}
                    className="w-40 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink focus:border-primary focus:outline-none"
                  />
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      title="Move up"
                      disabled={i === 0}
                      onClick={() =>
                        setAttribAuthors((prev) => {
                          if (i === 0) return prev;
                          const next = [...prev];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          return next;
                        })
                      }
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-soft hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      disabled={i === attribAuthors.length - 1}
                      onClick={() =>
                        setAttribAuthors((prev) => {
                          if (i === prev.length - 1) return prev;
                          const next = [...prev];
                          [next[i + 1], next[i]] = [next[i], next[i + 1]];
                          return next;
                        })
                      }
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-soft hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => setAttribAuthors((prev) => prev.filter((_, idx) => idx !== i))}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-soft hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="relative mt-3">
            <input
              value={authorSearch}
              onChange={(e) => setAuthorSearch(e.target.value)}
              placeholder="Search by name or @username…"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
            />
            {authorSearch.trim().length > 0 && (searchResults?.length ?? 0) > 0 && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-background shadow-lg">
                {(searchResults ?? [])
                  .filter((r) => !attribAuthors.some((a) => a.id === r.id))
                  .slice(0, 12)
                  .map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setAttribAuthors((prev) => [
                          ...prev,
                          {
                            id: r.id,
                            username: r.username,
                            display_name: r.display_name,
                            avatar_url: r.avatar_url,
                            role_label: "",
                          },
                        ]);
                        setAuthorSearch("");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted"
                    >
                      <Avatar className="h-6 w-6">
                        {r.avatar_url ? <AvatarImage src={r.avatar_url} alt="" /> : null}
                        <AvatarFallback className="text-[10px]">{(r.display_name ?? r.username ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-ink">{r.display_name ?? r.username}</div>
                        {r.username && <div className="truncate text-[11px] text-ink-muted">@{r.username}</div>}
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>


        <div className="mt-4">
          <label className="block text-xs font-medium uppercase tracking-wider text-ink-muted">Excerpt</label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            maxLength={320}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
            placeholder="One or two sentences that frame the post."
          />
          <div className="mt-1 text-[11px] text-ink-muted">{excerpt.length}/320</div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium uppercase tracking-wider text-ink-muted">Cover image</label>
          <div className="mt-1">
            <ImageUpload value={cover} onChange={setCover} bucket="covers" aspect="video" label="Upload cover" />
          </div>
          <label className="mt-3 block text-xs font-medium uppercase tracking-wider text-ink-muted">Cover alt text</label>
          <input
            value={coverAlt}
            onChange={(e) => setCoverAlt(e.target.value)}
            maxLength={240}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
            placeholder="Describe the image for screen readers"
          />
          {cover && !coverAlt.trim() && (
            <div className="mt-1 text-[11px] text-amber-600">Alt text is required before publishing.</div>
          )}
        </div>

        {/* "About this post" — category + connections, above the body. */}
        <div className="mt-4">
          <BlogAboutEditor
            fields={fields}
            tags={entityTags}
            onChangeFields={(next) => { setFields(next.length ? next : ["other"]); setDirty(true); }}
            onChangeTags={(next) => {
              setEntityTags(next);
              setDirty(true);
            }}
          />
        </div>


        <div className="mt-6">
          <Tabs defaultValue="edit">
            <TabsList>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="edit">
              <div className="mt-2 space-y-4">
                <BlogBodyEditor
                  value={body}
                  onChange={setBody}
                  onDirty={() => setDirty(true)}
                  onRequestEntityInsert={(insert) => {
                    setPendingInsertRef(() => insert);
                    setEntityPickerOpen(true);
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="preview">
              <div className="mt-2 rounded-2xl border border-border bg-surface p-6">
                <div className="text-[11px] uppercase tracking-[0.18em] text-ink-soft">
                  {fieldLabel(fields[0])}
                </div>
                <h1 className="mt-2 font-display text-3xl text-ink">{title || "Untitled"}</h1>
                {excerpt && <p className="mt-2 text-lg text-ink-soft">{excerpt}</p>}
                {cover && (
                  <img src={cover} alt={coverAlt} className="mt-4 w-full rounded-2xl border border-border object-cover" />
                )}
                <div className="mt-4 text-xs text-ink-muted">~{readingMin} min read</div>
                <div className="mt-4">
                  <BlogPostBody markdown={body} />
                </div>
                <BlogPostContext
                  context={deriveBlogPostContext({ categorySlug, tags: entityTags })}
                  className="mt-10"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>


      <aside className="space-y-6">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">Search preview</div>
          <div className="mt-2">
            <div className="truncate text-xs text-emerald-700">{effUrl}</div>
            <div className="mt-1 truncate text-base text-blue-700">{effTitle || "Your title"}</div>
            <div className="mt-1 line-clamp-2 text-sm text-ink-muted">{effDesc || "Your description will appear here."}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">Social card</div>
          <div className="mt-2 overflow-hidden rounded-xl border border-border">
            {cover ? (
              <img src={cover} alt="" className="aspect-video w-full object-cover" />
            ) : (
              <CategoryPlaceholder
                size="cover"
                category={fieldLabel(fields[0])}
                className="aspect-video w-full"
              />
            )}

            <div className="p-3">
              <div className="text-xs text-ink-muted">workshopindie.com</div>
              <div className="mt-0.5 line-clamp-2 text-sm font-medium text-ink">{effTitle || "Your title"}</div>
              <div className="mt-1 line-clamp-2 text-xs text-ink-muted">{effDesc || "Your description."}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">SEO overrides</div>
          <label className="mt-2 block text-xs text-ink-muted">SEO title ({seoTitle.length}/80)</label>
          <input
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            maxLength={80}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
          />
          <label className="mt-3 block text-xs text-ink-muted">SEO description ({seoDesc.length}/160)</label>
          <textarea
            value={seoDesc}
            onChange={(e) => setSeoDesc(e.target.value)}
            rows={3}
            maxLength={160}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
          />
        </div>
      </aside>
      <BlogEntityTagPicker
        open={entityPickerOpen}
        onOpenChange={setEntityPickerOpen}
        title={pendingInsertRef ? "Insert Workshop link" : "Add a connection"}
        description={
          pendingInsertRef
            ? "Insert an inline link to a Work, Collab, Group, Event, or person."
            : "Connect this post to the Work, Collab, Group, Event, or person it is substantially about."
        }
        disabledKeys={pendingInsertRef ? [] : entityTags.map(tagKey)}

        onPick={(tag) => {
          if (pendingInsertRef) {
            pendingInsertRef(entityMarkdown(tag));
            setPendingInsertRef(null);
          } else if (!entityTags.some((t) => tagKey(t) === tagKey(tag))) {
            setEntityTags([...entityTags, tag]);
            setDirty(true);
          }
          setEntityPickerOpen(false);
        }}
      />
    </div>
  );
}

