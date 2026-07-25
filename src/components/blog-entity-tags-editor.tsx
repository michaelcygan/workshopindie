import { useMemo, useState } from "react";
import { Briefcase, Users, MapPin, Calendar, User, ChevronUp, ChevronDown, X, Plus } from "lucide-react";
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
  const disabledKeys = useMemo(() => value.map(tagKey), [value]);
  const atCap = value.length >= MAX_BLOG_ENTITY_TAGS;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            Connected to this post
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">
            Link Works, Collabs, Groups, Events, or People this post is about.
          </p>
        </div>
        <button
          type="button"
          disabled={readOnly || atCap}
          onClick={() => setPickerOpen(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-ink-soft hover:bg-muted disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Tag something
        </button>
      </div>

      {value.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-ink-muted">
          No tags yet. Connect this post to something on Workshop.
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
                <Avatar className="h-7 w-7">
                  {tag.image ? <AvatarImage src={tag.image} alt="" /> : null}
                  <AvatarFallback className="text-[10px]">
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
                {!readOnly && (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      title="Move up"
                      disabled={i === 0}
                      onClick={() => {
                        const next = [...value];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        onChange(next);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-soft hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      disabled={i === value.length - 1}
                      onClick={() => {
                        const next = [...value];
                        [next[i + 1], next[i]] = [next[i], next[i + 1]];
                        onChange(next);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-soft hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-soft hover:bg-muted"
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
        <div className="mt-2 text-[11px] text-ink-muted">Maximum of {MAX_BLOG_ENTITY_TAGS} tags reached.</div>
      )}

      <BlogEntityTagPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(tag) => {
          if (value.some((v) => tagKey(v) === tagKey(tag))) return;
          onChange([...value, tag]);
        }}
        disabledKeys={disabledKeys}
      />
    </div>
  );
}
