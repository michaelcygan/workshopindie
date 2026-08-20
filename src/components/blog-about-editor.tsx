import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Briefcase,
  Users,
  MapPin,
  Calendar,
  User,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  X,
  Plus,
  ArrowUpRight,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BlogEntityTagPicker } from "@/components/blog-entity-tag-picker";
import { QuickCreateWorkSheet } from "@/components/quick-create-work-sheet";
import type { BlogEntityKind, BlogEntityTag } from "@/lib/blog-entity-tags";
import { MAX_BLOG_ENTITY_TAGS, tagKey } from "@/lib/blog-entity-tags";
import { deriveBlogPostContext } from "@/lib/blog-post-context";
import { blogCategorySlugForField } from "@/lib/blog-categories";
import { FieldPicker } from "@/components/field-picker";
import { fieldClass, fieldLabel, subcategoryLabel, type FieldId } from "@/lib/taxonomy";
import {
  BLOG_STORY_TYPES,
  MAX_BLOG_SUBJECTS,
  blogSectionForStoryType,
  type BlogStoryType,
} from "@/lib/blog-story-types";
import { TopicPicker, type PickerTopic } from "@/components/topics/topic-picker";


const KIND_ICONS: Record<BlogEntityKind, typeof Briefcase> = {
  work: Briefcase,
  collab: Users,
  group: MapPin,
  event: Calendar,
  profile: User,
  post: BookOpen,
};

const ROWS: Array<{ kind: BlogEntityKind; label: string; plural: string; add: string }> = [
  { kind: "work", label: "Work", plural: "Works", add: "Add a Work" },
  { kind: "profile", label: "Person", plural: "People", add: "Add a person" },
  { kind: "collab", label: "Collab", plural: "Collabs", add: "Add a Collab" },
  { kind: "group", label: "Group", plural: "Groups", add: "Add a Group" },
  { kind: "event", label: "Event", plural: "Events", add: "Add an Event" },
  { kind: "post", label: "Blog post", plural: "Blog posts", add: "Add a Blog post" },
];

/** Compact labelled block: label sits above its control, no gutter column. */
function Block({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[11px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1.5 min-w-0">{children}</div>
    </div>
  );
}


/**
 * Authoring twin of the public `BlogPostContext` colophon. Same order, same
 * derivation (`deriveBlogPostContext`), so what an owner edits here is exactly
 * what readers see under "About this post".
 */
export function BlogAboutEditor({
  fields,
  subcategory,
  onChangeSubcategory,
  postType,
  onChangePostType,
  subjects,
  topics,
  onChangeTopics,
  tags,
  readOnly,
  onChangeFields,
  onChangeTags,
  canCreateWork = true,
  postId,
}: {
  /** Canonical Fields, primary first. Never empty — default `["other"]`. */
  fields: FieldId[];
  /** Optional specialization beneath the primary Field. */
  subcategory?: string | null;
  onChangeSubcategory?: (next: string | null) => void;
  /**
   * What kind of piece this is. Exactly one; the public editorial Category is
   * derived from it, never authored separately.
   */
  postType: BlogStoryType | null;
  onChangePostType: (next: BlogStoryType | null) => void;
  /** What the post is directly about. Optional, up to `MAX_BLOG_SUBJECTS`. */
  subjects: string[];
  /** Canonical Topics attached to this post (shared with Works, Collabs, etc.). */
  topics: PickerTopic[];
  onChangeTopics: (next: PickerTopic[]) => void;
  tags: BlogEntityTag[];
  readOnly?: boolean;
  onChangeFields: (next: FieldId[]) => void;
  onChangeTags: (next: BlogEntityTag[]) => void;
  /** Quick Work creation requires a signed-in member (not the admin CMS). */
  canCreateWork?: boolean;
  /** The post being edited — never offered as its own connection. */
  postId?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerKind, setPickerKind] = useState<BlogEntityKind | "all">("all");
  const [createWorkOpen, setCreateWorkOpen] = useState(false);
  // Collapsed once the post already carries structure; open while it's blank.
  const [open, setOpen] = useState(() => !postType && tags.length === 0);


  const primaryField: FieldId = fields[0] ?? "other";
  const extraFields = fields.slice(1);
  // `category_slug` stays a derived value so historic /blog/c/<slug> URLs work.
  const categorySlug = blogCategorySlugForField(primaryField);

  const disabledKeys = useMemo(() => tags.map(tagKey), [tags]);
  const atCap = tags.length >= MAX_BLOG_ENTITY_TAGS;
  const context = useMemo(
    () =>
      deriveBlogPostContext({ storyType: postType, fields, subjects, categorySlug, tags }),
    [postType, fields, subjects, categorySlug, tags],
  );
  const section = blogSectionForStoryType(postType);

  function openPicker(kind: BlogEntityKind | "all") {
    setPickerKind(kind);
    setPickerOpen(true);
  }

  function addTag(tag: BlogEntityTag) {
    if (tags.some((t) => tagKey(t) === tagKey(tag))) return;
    if (tags.length >= MAX_BLOG_ENTITY_TAGS) return;
    onChangeTags([...tags, tag]);
  }

  function move(tag: BlogEntityTag, dir: -1 | 1) {
    const i = tags.findIndex((t) => tagKey(t) === tagKey(tag));
    const j = i + dir;
    if (i < 0 || j < 0 || j >= tags.length) return;
    const next = [...tags];
    [next[i], next[j]] = [next[j], next[i]];
    onChangeTags(next);
  }

  function remove(tag: BlogEntityTag) {
    onChangeTags(tags.filter((t) => tagKey(t) !== tagKey(tag)));
  }

  function TagRow({ tag }: { tag: BlogEntityTag }) {

    const Icon = KIND_ICONS[tag.kind];
    const i = tags.findIndex((t) => tagKey(t) === tagKey(tag));
    return (
      <li className="flex items-center gap-2 rounded-xl border border-border bg-background px-2 py-1.5">
        <Avatar className="h-8 w-8 rounded-lg">
          {tag.image ? <AvatarImage src={tag.image} alt="" className="object-cover" /> : null}
          <AvatarFallback className="rounded-lg text-[10px]">
            <Icon className="h-3.5 w-3.5" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-ink">{tag.label}</div>
          {tag.sublabel && <div className="truncate text-[11px] text-ink-muted">{tag.sublabel}</div>}
        </div>
        {tag.kind === "post" && (
          <Link
            to="/blog/$slug"
            params={{ slug: tag.slug }}
            target="_blank"
            rel="noreferrer"
            title="Open this Blog post"
            aria-label={`Open Blog post ${tag.label} in a new tab`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-muted"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
        {tag.kind === "work" && (
          <Link
            to="/works/$slug"
            params={{ slug: tag.slug }}
            target="_blank"
            rel="noreferrer"
            title="Open Work to add cover and details"
            aria-label={`Open Work ${tag.label} in a new tab`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-muted"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
        {!readOnly && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Move up"
              aria-label={`Move ${tag.label} up`}
              disabled={i === 0}
              onClick={() => move(tag, -1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-muted disabled:opacity-30"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Move down"
              aria-label={`Move ${tag.label} down`}
              disabled={i === tags.length - 1}
              onClick={() => move(tag, 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-muted disabled:opacity-30"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Remove"
              aria-label={`Remove link to ${tag.label}`}
              onClick={() => remove(tag)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </li>
    );
  }

  const byKind: Record<BlogEntityKind, BlogEntityTag[]> = {
    work: context.works,
    profile: context.people,
    collab: context.collabs,
    group: context.groups,
    event: context.events,
    post: context.posts,
  };

  const summary = [
    section?.label ?? (postType ? null : "No post type"),
    fieldLabel(primaryField),
    topics.length > 0 ? `${topics.length} topic${topics.length === 1 ? "" : "s"}` : null,
    tags.length > 0 ? `${tags.length} connection${tags.length === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="group flex min-w-0 items-center gap-1.5 text-left"
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform",
              open && "rotate-90",
            )}
          />
          <h2 className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">About this post</h2>
        </button>
        <span className="text-[11px] text-ink-muted">
          {tags.length}/{MAX_BLOG_ENTITY_TAGS} linked items
        </span>
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1.5 flex w-full items-center gap-2 text-left text-xs text-ink-soft hover:text-ink"
        >
          <span className="min-w-0 flex-1 truncate">{summary}</span>
          <span className="shrink-0 text-[11px] underline underline-offset-2">Edit</span>
        </button>
      ) : (
        <>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
            The structured record readers see under your story — and how the post shows up on the
            pages it is about.
          </p>

          <div className="mt-3 grid gap-4 border-t border-border pt-3 md:grid-cols-2 md:gap-x-8">
            <Block label="Post type" className="md:col-span-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {BLOG_STORY_TYPES.map((t) => {
                  const active = postType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={readOnly}
                      aria-pressed={active}
                      onClick={() => onChangePostType(active ? null : t.id)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                        active
                          ? "border-ink bg-ink text-surface"
                          : "border-border bg-background text-ink-soft hover:border-ink/40"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
                <span className="ml-1 text-[11px] text-ink-muted">
                  {section ? `Publishes under ${section.label}.` : "Decides the Blog section."}
                </span>
              </div>
            </Block>

            <Block label={fields.length === 1 ? "Field" : "Fields"}>
              {readOnly ? (
                <div className="flex flex-wrap gap-2">
                  {fields.map((f) => (
                    <span
                      key={f}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${fieldClass(f)}`}
                    >
                      {fieldLabel(f)}
                    </span>
                  ))}
                </div>
              ) : (
                <FieldPicker
                  label=""
                  primary={primaryField}
                  extras={extraFields}
                  onChange={(next) => onChangeFields(next)}
                  onPrimaryChange={(next) => onChangeFields([next, ...extraFields.filter((f) => f !== next)])}
                  onExtrasChange={(next) => onChangeFields([primaryField, ...next.filter((f) => f !== primaryField)])}
                  hint="Up to 3 — star one to lead with it."
                />
              )}
            </Block>

            <Block label={topics.length === 1 ? "Topic" : "Topics"}>
              {readOnly ? (
                <div className="text-sm text-ink-soft">
                  {topics.length > 0
                    ? topics.map((t) => t.name).join(" · ")
                    : subjects.length > 0
                      ? subjects.join(" · ")
                      : "—"}
                </div>
              ) : (
                <TopicPicker
                  label=""
                  value={topics}
                  onChange={onChangeTopics}
                  max={MAX_BLOG_SUBJECTS}
                  helper={`Optional, up to ${MAX_BLOG_SUBJECTS}. The first one leads.`}
                />
              )}
            </Block>

            {/* Specialization is legacy: preserved on posts that carry one, never
                offered in new authoring. */}
            {subcategory && (
              <Block label="Specialization">
                <div className="text-sm text-ink-soft">{subcategoryLabel(subcategory)}</div>
              </Block>
            )}

            {/* One list for every kind — Works, People, Collabs, Groups, Events, posts. */}
            <Block label="Connections" className="md:col-span-2">
              {tags.length > 0 && (
                <ul className="grid gap-1.5 md:grid-cols-2">
                  {ROWS.flatMap((row) => byKind[row.kind]).map((t) => (
                    <TagRow key={tagKey(t)} tag={t} />
                  ))}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={readOnly || atCap}
                      className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs text-ink-soft transition hover:bg-muted disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {tags.length > 0 ? "Add another" : "Add a connection"}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {ROWS.map((row) => {
                      const Icon = KIND_ICONS[row.kind];
                      return (
                        <DropdownMenuItem key={row.kind} onSelect={() => openPicker(row.kind)}>
                          <Icon className="mr-2 h-3.5 w-3.5" /> {row.add}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
                {canCreateWork && (
                  <button
                    type="button"
                    disabled={readOnly || atCap}
                    onClick={() => setCreateWorkOpen(true)}
                    className="text-xs text-primary hover:underline disabled:opacity-40"
                  >
                    Can't find it? Create a Work
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-ink-muted">
                Link the Works, people, Collabs, Groups, Events, or posts this story is about.
              </p>
            </Block>
          </div>
        </>
      )}

      {open && atCap && (
        <div className="mt-2 text-[11px] text-ink-muted">
          Maximum of {MAX_BLOG_ENTITY_TAGS} linked items reached.
        </div>
      )}


      <BlogEntityTagPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initialKind={pickerKind}
        title={
          pickerKind === "work"
            ? "Connect a Work"
            : pickerKind === "post"
              ? "Connect a Blog post"
              : "Add a linked item"
        }
        description={
          pickerKind === "post"
            ? "Connect a published Workshop story this post cites, continues, responds to, or recommends."
            : "Connect this post to the Work, Collab, Group, Event, or person it is substantially about."
        }
        disabledKeys={disabledKeys}
        excludeKeys={postId ? [`post:${postId}`] : []}
        onPick={addTag}
        {...(canCreateWork ? { onRequestCreateWork: () => { setPickerOpen(false); setCreateWorkOpen(true); } } : {})}
      />

      {canCreateWork && (
        <QuickCreateWorkSheet
          open={createWorkOpen}
          onOpenChange={setCreateWorkOpen}
          onCreated={addTag}
        />
      )}
    </section>
  );
}
