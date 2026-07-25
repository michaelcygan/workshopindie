import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/image-upload";
import { BlogPostBody } from "@/components/blog-post-body";
import {
  adminCreateDraft, adminUpdatePost, adminPublishPost, adminUnpublishPost, adminDeleteDraft,
  adminListAuthorProfiles, adminSearchAuthorProfiles, adminSetPostAuthors,
} from "@/lib/blog.functions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bold, Italic, Link as LinkIcon, Quote, List, ListOrdered, Heading2, Heading3, Image as ImageIcon, ChevronUp, ChevronDown, X } from "lucide-react";

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
  author_profile?: { username: string | null } | null;
  status?: "draft" | "published";
  published_at?: string | null;
  authors?: Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null; role_label: string | null }>;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const create = useServerFn(adminCreateDraft);
  const update = useServerFn(adminUpdatePost);
  const publish = useServerFn(adminPublishPost);
  const unpublish = useServerFn(adminUnpublishPost);
  const del = useServerFn(adminDeleteDraft);
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
  const effUrl = `${SITE}/blog/${slug || "your-slug"}`;

  function insertAtCursor(before: string, after = "", placeholder = "") {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = body.slice(start, end) || placeholder;
    const next = body.slice(0, start) + before + sel + after + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + before.length + sel.length + after.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function flushAuthors(postId: string) {
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
      toast.error(`Attributed authors: ${(e as Error).message}`);
    }
  }

  async function onSave() {
    if (!title.trim()) return toast.error("Title is required.");
    setSaving(true);
    try {
      if (isNew) {
        const res = await create({ data: buildPayload() });
        await flushAuthors(res.id);
        toast.success("Draft saved.");
        setDirty(false);
        navigate({ to: "/admin/blog/$id", params: { id: res.id } });
      } else {
        await update({ data: { id: initial!.id!, ...buildPayload(), slug: everPublished ? undefined : slug } });
        await flushAuthors(initial!.id!);
        toast.success("Saved.");
        setDirty(false);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
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
    };
  }

  async function onPublish() {
    if (!initial?.id) { await onSave(); return; }
    if (dirty) await onSave();
    try {
      await publish({ data: { id: initial.id } });
      toast.success("Published.");
      navigate({ to: "/admin/blog" });
    } catch (e) { toast.error((e as Error).message); }
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
            <Button variant="outline" size="sm" className="rounded-full" onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save draft"}
            </Button>
            {isPublished ? (
              <Button variant="outline" size="sm" className="rounded-full" onClick={onUnpublish}>Unpublish</Button>
            ) : (
              <Button size="sm" className="rounded-full" onClick={onPublish}>{everPublished ? "Republish" : "Publish"}</Button>
            )}
            {isPublished && (
              <Link to="/blog/$slug" params={{ slug: initial!.slug! }} target="_blank">
                <Button variant="ghost" size="sm" className="rounded-full">View</Button>
              </Link>
            )}
            {!everPublished && !isNew && (
              <Button variant="ghost" size="sm" className="rounded-full text-destructive" onClick={onDelete}>Delete</Button>
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

        <div className="mt-6">
          <Tabs defaultValue="edit">
            <TabsList>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="edit">
              <div className="mt-2 flex flex-wrap items-center gap-1 rounded-full bg-muted p-1 text-xs">
                <ToolBtn onClick={() => insertAtCursor("## ", "", "Heading")} title="Heading 2"><Heading2 className="h-3.5 w-3.5" /></ToolBtn>
                <ToolBtn onClick={() => insertAtCursor("### ", "", "Heading")} title="Heading 3"><Heading3 className="h-3.5 w-3.5" /></ToolBtn>
                <ToolBtn onClick={() => insertAtCursor("**", "**", "bold")} title="Bold"><Bold className="h-3.5 w-3.5" /></ToolBtn>
                <ToolBtn onClick={() => insertAtCursor("_", "_", "italic")} title="Italic"><Italic className="h-3.5 w-3.5" /></ToolBtn>
                <ToolBtn onClick={() => insertAtCursor("[", "](https://)", "link text")} title="Link"><LinkIcon className="h-3.5 w-3.5" /></ToolBtn>
                <ToolBtn onClick={() => insertAtCursor("> ", "", "quote")} title="Quote"><Quote className="h-3.5 w-3.5" /></ToolBtn>
                <ToolBtn onClick={() => insertAtCursor("- ", "", "item")} title="Bulleted list"><List className="h-3.5 w-3.5" /></ToolBtn>
                <ToolBtn onClick={() => insertAtCursor("1. ", "", "item")} title="Numbered list"><ListOrdered className="h-3.5 w-3.5" /></ToolBtn>
                <ToolBtn onClick={() => insertAtCursor("![", "](https://)", "alt")} title="Image by URL"><ImageIcon className="h-3.5 w-3.5" /></ToolBtn>
              </div>
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={22}
                className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 font-mono text-sm text-ink focus:border-primary focus:outline-none"
                placeholder="Write in Markdown…"
              />
              <div className="mt-1 text-[11px] text-ink-muted">{wordCount} words · ~{readingMin} min read</div>
            </TabsContent>
            <TabsContent value="preview">
              <div className="mt-2 rounded-2xl border border-border bg-surface p-6">
                <h1 className="font-display text-3xl text-ink">{title || "Untitled"}</h1>
                {excerpt && <p className="mt-2 text-lg text-ink-soft">{excerpt}</p>}
                {cover && (
                  <img src={cover} alt={coverAlt} className="mt-4 w-full rounded-2xl border border-border object-cover" />
                )}
                <div className="mt-4 text-xs text-ink-muted">~{readingMin} min read</div>
                <div className="mt-4">
                  <BlogPostBody markdown={body} />
                </div>
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
              <div className="aspect-video w-full gradient-motion" />
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
    </div>
  );
}

function ToolBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-soft hover:bg-background"
    >
      {children}
    </button>
  );
}
