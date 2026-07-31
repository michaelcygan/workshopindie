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
import type { BlogEntityKind, BlogEntityTag } from "@/lib/blog-entity-tags";
import { MAX_BLOG_ENTITY_TAGS, kindLabel, tagKey } from "@/lib/blog-entity-tags";

const KIND_ICONS: Record<BlogEntityKind, typeof Briefcase> = {
  work: Briefcase,
  collab: Users,
  group: MapPin,
  event: Calendar,
  profile: User,
};

export function BlogEntityTagsEditor({
  value,
  onChange,
  readOnly,
}: {
  value: BlogEntityTag[];
  onChange: (next: BlogEntityTag[]) => void;
  readOnly?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerKind, setPickerKind] = useState<BlogEntityKind | "all">("all");
  const disabledKeys = useMemo(() => value.map(tagKey), [value]);
  const atCap = value.length >= MAX_BLOG_ENTITY_TAGS;
  const hasWork = value.some((t) => t.kind === "work");

  function openPicker(kind: BlogEntityKind | "all") {
    setPickerKind(kind);
    setPickerOpen(true);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div>
        <div className="text-xs font-medium uppercase tracking-wider text-ink-muted">Connections</div>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
          Connect this post to the Work, people, or places it is substantially about. Published posts may appear on
          those pages.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={readOnly || atCap}
          onClick={() => openPicker("work")}
          aria-label="Connect a Work to this post"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ink bg-ink px-3.5 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-40"
        >
          <Briefcase className="h-3.5 w-3.5" /> {hasWork ? "Connect another Work" : "Connect a Work"}
        </button>
        <button
          type="button"
          disabled={readOnly || atCap}
          onClick={() => openPicker("all")}
          aria-label="Add another connection to this post"
          className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs text-ink-soft transition hover:bg-muted disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Add another connection
        </button>
      </div>

      {value.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-ink-muted">
          No connections yet. Start with the Work this post is about.
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {value.map((tag, i) => {
            const Icon = KIND_ICONS[tag.kind];
            return (
              <li
                key={tagKey(tag)}
                className="flex items-center gap-2 rounded-xl border border-border bg-background px-2 py-1.5"
              >
                <Avatar className="h-9 w-9 rounded-lg">
                  {tag.image ? <AvatarImage src={tag.image} alt="" className="object-cover" /> : null}
                  <AvatarFallback className="rounded-lg text-[10px]">
                    <Icon className="h-3.5 w-3.5" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-ink">{tag.label}</div>
                  <div className="truncate text-[11px] text-ink-muted">
                    {kindLabel(tag.kind)}
                    {tag.sublabel ? ` · ${tag.sublabel}` : ""}
                  </div>
                </div>
                {tag.kind === "work" && (
                  <Link
                    to="/works/$slug"
                    params={{ slug: tag.slug }}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open Work ${tag.label} in a new tab`}
                    title="Open Work"
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
                      onClick={() => {
                        const next = [...value];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        onChange(next);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      aria-label={`Move ${tag.label} down`}
                      disabled={i === value.length - 1}
                      onClick={() => {
                        const next = [...value];
                        [next[i + 1], next[i]] = [next[i], next[i + 1]];
                        onChange(next);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      aria-label={`Remove connection to ${tag.label}`}
                      onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {atCap && (
        <div className="mt-2 text-[11px] text-ink-muted">Maximum of {MAX_BLOG_ENTITY_TAGS} connections reached.</div>
      )}

      <BlogEntityTagPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initialKind={pickerKind}
        title={pickerKind === "work" ? "Connect a Work" : "Add a connection"}
        description="Connect this post to the Work, Collab, Group, Event, or person it is substantially about."
        onPick={(tag) => {
          if (value.some((v) => tagKey(v) === tagKey(tag))) return;
          onChange([...value, tag]);
        }}
        disabledKeys={disabledKeys}
      />
    </div>
  );
}
