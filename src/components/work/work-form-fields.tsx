/**
 * The shared Work field components.
 *
 * "Post to Gallery" and "Edit Work" both render these — there is one set of
 * fields, one set of labels, one validation model.
 */
import { useMemo, useState } from "react";
import { X, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FIELD_FILTER_OPTIONS, fieldLabel, type FieldId } from "@/lib/taxonomy";
import {
  DETAIL_FIELD_LABELS,
  categoriesForMedium,
  categoryUsesMaterial,
  detailFieldsFor,
  workCategoryById,
} from "@/lib/work-categories";
import { PUBLICATION_DATE_HELP } from "@/lib/work-dates";
import {
  MATERIAL_SUGGESTIONS,
  MAX_MATERIALS,
  MAX_SUBJECTS,
  SUBJECT_SUGGESTIONS,
  normalizeTags,
} from "@/lib/work-tags";
import { DIMENSION_UNITS, LICENSE_OPTIONS, type WorkDetails, type WorkFormValues } from "@/lib/work-form";

/* -------------------------------------------------------------------------- */
/* Medium + Category                                                          */
/* -------------------------------------------------------------------------- */

export function MediumCategoryPicker({
  medium,
  categoryId,
  onMediumChange,
  onCategoryChange,
}: {
  medium: FieldId | "";
  categoryId: string;
  onMediumChange: (m: FieldId) => void;
  onCategoryChange: (c: string) => void;
}) {
  const categories = useMemo(() => (medium ? categoriesForMedium(medium) : []), [medium]);
  const selected = workCategoryById(categoryId);
  // A Category can live under several Mediums; only reset when it truly can't.
  const categoryValid = !!selected && !!medium && selected.mediums.includes(medium as FieldId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Medium</Label>
        <p className="text-xs text-ink-muted">The broad creative lane this Work belongs to.</p>
        <div className="flex flex-wrap gap-1.5">
          {FIELD_FILTER_OPTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                onMediumChange(f.id);
                const stillOk = selected?.mediums.includes(f.id);
                if (!stillOk) onCategoryChange("");
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition",
                medium === f.id
                  ? "border-ink bg-ink text-background"
                  : "border-border bg-surface text-ink-soft hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <p className="text-xs text-ink-muted">The precise kind of Work — a Trailer, a Painting, a Dataset.</p>
        <Select
          value={categoryValid ? categoryId : ""}
          onValueChange={onCategoryChange}
          disabled={!medium}
        >
          <SelectTrigger>
            <SelectValue placeholder={medium ? "Choose a Category" : "Pick a Medium first"} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** Non-blocking prompt for Work that predates the Category registry. */
export function ClassificationNudge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-ink-muted">
      This Work was posted before Categories existed. Picking one makes it easier to find —
      nothing breaks if you skip it.
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Tag field — Subject and Material                                           */
/* -------------------------------------------------------------------------- */

export function TagField({
  label,
  help,
  values,
  onChange,
  suggestions,
  max,
  placeholder,
}: {
  label: string;
  help?: string;
  values: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
  max: number;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const next = normalizeTags([...values, raw], max);
    onChange(next);
    setDraft("");
  };
  const remaining = suggestions.filter(
    (s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {help && <p className="text-xs text-ink-muted">{help}</p>}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink"
            >
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="text-ink-muted hover:text-ink"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {values.length < max && (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (draft.trim()) add(draft);
              }
            }}
            placeholder={placeholder ?? "Add another…"}
            className="h-9"
          />
          <button
            type="button"
            onClick={() => draft.trim() && add(draft)}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-border bg-surface px-3 text-xs text-ink-soft hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      )}
      {values.length < max && remaining.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {remaining.slice(0, 10).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-ink-muted hover:bg-muted hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SubjectField({
  values,
  onChange,
}: {
  values: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <TagField
      label="Subject"
      help="What this Work is about."
      values={values}
      onChange={onChange}
      suggestions={SUBJECT_SUGGESTIONS}
      max={MAX_SUBJECTS}
      placeholder="e.g. Nightlife"
    />
  );
}

export function MaterialField({
  categoryId,
  values,
  onChange,
}: {
  categoryId: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  if (!categoryUsesMaterial(categoryId)) return null;
  return (
    <TagField
      label="Material"
      help="What this Work is physically made from — not a file format."
      values={values}
      onChange={onChange}
      suggestions={MATERIAL_SUGGESTIONS}
      max={MAX_MATERIALS}
      placeholder="e.g. Terracotta"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Publication date                                                           */
/* -------------------------------------------------------------------------- */

export function PublicationDateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="publication-date">Publication date</Label>
      <Input
        id="publication-date"
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-56"
      />
      <p className="text-xs text-ink-muted">{PUBLICATION_DATE_HELP}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Category-driven factual details                                            */
/* -------------------------------------------------------------------------- */

export function CategoryDetailFields({
  categoryId,
  value,
  onChange,
}: {
  categoryId: string;
  value: WorkDetails;
  onChange: (v: WorkDetails) => void;
}) {
  const fields = detailFieldsFor(categoryId);
  if (fields.length === 0) return null;
  const set = (patch: Partial<WorkDetails>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-medium text-ink">Details</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.includes("dimensions") && (
          <div className="space-y-1.5">
            <Label htmlFor="d-dimensions">{DETAIL_FIELD_LABELS.dimensions}</Label>
            <div className="flex gap-2">
              <Input
                id="d-dimensions"
                value={value.dimensions ?? ""}
                onChange={(e) => set({ dimensions: e.target.value })}
                placeholder="60 × 90"
              />
              <Select
                value={value.dimensions_unit ?? "cm"}
                onValueChange={(u) => set({ dimensions_unit: u })}
              >
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIMENSION_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {fields.includes("duration") && (
          <div className="space-y-1.5">
            <Label htmlFor="d-duration">{DETAIL_FIELD_LABELS.duration}</Label>
            <Input
              id="d-duration"
              value={value.duration ?? ""}
              onChange={(e) => set({ duration: e.target.value })}
              placeholder="2:31"
            />
          </div>
        )}
        {fields.includes("piece_count") && (
          <div className="space-y-1.5">
            <Label htmlFor="d-pieces">{DETAIL_FIELD_LABELS.piece_count}</Label>
            <Input
              id="d-pieces"
              type="number"
              min={1}
              value={value.piece_count ?? ""}
              onChange={(e) =>
                set({ piece_count: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="12"
            />
          </div>
        )}
        {fields.includes("track_count") && (
          <div className="space-y-1.5">
            <Label htmlFor="d-tracks">{DETAIL_FIELD_LABELS.track_count}</Label>
            <Input
              id="d-tracks"
              type="number"
              min={1}
              value={value.track_count ?? ""}
              onChange={(e) =>
                set({ track_count: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="10"
            />
          </div>
        )}
        {fields.includes("edition") && (
          <div className="space-y-1.5">
            <Label htmlFor="d-edition">{DETAIL_FIELD_LABELS.edition}</Label>
            <Input
              id="d-edition"
              value={value.edition ?? ""}
              onChange={(e) => set({ edition: e.target.value })}
              placeholder="3 of 25"
            />
          </div>
        )}
        {fields.includes("version") && (
          <div className="space-y-1.5">
            <Label htmlFor="d-version">{DETAIL_FIELD_LABELS.version}</Label>
            <Input
              id="d-version"
              value={value.version ?? ""}
              onChange={(e) => set({ version: e.target.value })}
              placeholder="1.2.0"
            />
          </div>
        )}
        {fields.includes("repository") && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="d-repo">{DETAIL_FIELD_LABELS.repository}</Label>
            <Input
              id="d-repo"
              value={value.repository ?? ""}
              onChange={(e) => set({ repository: e.target.value })}
              placeholder="https://github.com/…"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Publishing                                                                 */
/* -------------------------------------------------------------------------- */

export function LicenseField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Rights & license</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {LICENSE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function VisibilityField({
  value,
  onChange,
}: {
  value: WorkFormValues["visibility"];
  onChange: (v: WorkFormValues["visibility"]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Visibility</Label>
      <Select value={value} onValueChange={(v) => onChange(v as WorkFormValues["visibility"])}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="public">Public — appears in the Gallery</SelectItem>
          <SelectItem value="unlisted">Unlisted — reachable by link only</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-ink-muted">
        Unlisted Work never shows up in Gallery browsing or filters.
      </p>
    </div>
  );
}

export { fieldLabel as mediumLabel };
