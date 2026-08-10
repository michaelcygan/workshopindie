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
  X,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BlogEntityTagPicker } from "@/components/blog-entity-tag-picker";
import { QuickCreateWorkSheet } from "@/components/quick-create-work-sheet";
import type { BlogEntityKind, BlogEntityTag } from "@/lib/blog-entity-tags";
import { MAX_BLOG_ENTITY_TAGS, tagKey } from "@/lib/blog-entity-tags";
import { deriveBlogPostContext } from "@/lib/blog-post-context";
import { blogCategorySlugForField } from "@/lib/blog-categories";
import { FieldPicker } from "@/components/field-picker";
import { fieldClass, fieldLabel, type FieldId } from "@/lib/taxonomy";

const KIND_ICONS: Record<BlogEntityKind, typeof Briefcase> = {
  work: Briefcase,
  collab: Users,
  group: MapPin,
  event: Calendar,
  profile: User,
};

const ROWS: Array<{ kind: BlogEntityKind; label: string; plural: string; add: string }> = [
  { kind: "work", label: "Work", plural: "Works", add: "Add a Work" },
  { kind: "profile", label: "Person", plural: "People", add: "Add a person" },
  { kind: "collab", label: "Collab", plural: "Collabs", add: "Add a Collab" },
  { kind: "group", label: "Group", plural: "Groups", add: "Add a Group" },
  { kind: "event", label: "Event", plural: "Events", add: "Add an Event" },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1.5 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-6 sm:py-4">
      <div className="pt-1 text-[11px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="min-w-0">{children}</div>
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
  tags,
  readOnly,
  onChangeFields,
  onChangeTags,
  canCreateWork = true,
}: {
  /** Canonical Fields, primary first. Never empty — default `["other"]`. */
  fields: FieldId[];
  tags: BlogEntityTag[];
  readOnly?: boolean;
  onChangeFields: (next: FieldId[]) => void;
  onChangeTags: (next: BlogEntityTag[]) => void;
  /** Quick Work creation requires a signed-in member (not the admin CMS). */
  canCreateWork?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerKind, setPickerKind] = useState<BlogEntityKind | "all">("all");
  const [createWorkOpen, setCreateWorkOpen] = useState(false);

  const primaryField: FieldId = fields[0] ?? "other";
  const extraFields = fields.slice(1);
  // `category_slug` stays a derived value so historic /blog/c/<slug> URLs work.
  const categorySlug = blogCategorySlugForField(primaryField);

  const disabledKeys = useMemo(() => tags.map(tagKey), [tags]);
  const atCap = tags.length >= MAX_BLOG_ENTITY_TAGS;
  const context = useMemo(() => deriveBlogPostContext({ categorySlug, tags }), [categorySlug, tags]);

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

  function AddButton({ kind, label }: { kind: BlogEntityKind; label: string }) {
    return (
      <button
        type="button"
        disabled={readOnly || atCap}
        onClick={() => openPicker(kind)}
        className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs text-ink-soft transition hover:bg-muted disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" /> {label}
      </button>
    );
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
              aria-label={`Remove connection to ${tag.label}`}
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
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">About this post</h2>
        <span className="text-[11px] text-ink-muted">
          {tags.length}/{MAX_BLOG_ENTITY_TAGS} connections
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
        This is the structured record readers see under your story — and how the post shows up on the
        pages it is about.
      </p>

      <div className="mt-2 divide-y divide-border border-t border-border">
        <Row label="Category">
          <div className="flex flex-wrap gap-2">
            {BLOG_CATEGORIES.map((c) => {
              const active = c.slug === categorySlug;
              return (
                <button
                  key={c.slug}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={active}
                  onClick={() => onChangeCategory(c.slug)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    active
                      ? "border-ink bg-ink text-surface"
                      : "border-border bg-background text-ink-soft hover:border-ink/40"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </Row>

        <Row label={context.mediums.length === 1 ? "Medium" : "Mediums"}>
          {context.mediums.length > 0 ? (
            <div className="text-sm text-ink-soft">{context.mediums.join(" · ")}</div>
          ) : (
            <div className="text-xs text-ink-muted">Mediums come from the Works you connect.</div>
          )}
        </Row>

        {ROWS.map((row) => {
          const items = byKind[row.kind];
          return (
            <Row key={row.kind} label={items.length === 1 ? row.label : row.plural}>
              {items.length > 0 && (
                <ul className="space-y-2">
                  {items.map((t) => (
                    <TagRow key={tagKey(t)} tag={t} />
                  ))}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <AddButton kind={row.kind} label={items.length > 0 ? "Add another" : row.add} />
                {row.kind === "work" && canCreateWork && (
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
            </Row>
          );
        })}
      </div>

      {atCap && (
        <div className="mt-2 text-[11px] text-ink-muted">
          Maximum of {MAX_BLOG_ENTITY_TAGS} connections reached.
        </div>
      )}

      <BlogEntityTagPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initialKind={pickerKind}
        title={pickerKind === "work" ? "Connect a Work" : "Add a connection"}
        description="Connect this post to the Work, Collab, Group, Event, or person it is substantially about."
        disabledKeys={disabledKeys}
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
