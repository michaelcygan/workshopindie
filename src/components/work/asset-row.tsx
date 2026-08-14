import { ArrowDown, ArrowUp, Link2, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ASSET_TYPE_LABELS, formatBytes, type WorkAssetType } from "@/lib/work-assets";

/**
 * One media row, shared by the creation composer (staged, in-memory) and the
 * edit page (persisted). Both surfaces look identical on purpose: a creator
 * shouldn't have to relearn the control after publishing.
 */
export type AssetRowValue = {
  assetType: WorkAssetType;
  url: string;
  previewUrl?: string | null;
  caption: string;
  alt: string;
  byteSize?: number | null;
  /** Only uploaded files can offer a download toggle. */
  hosted: boolean;
  downloadEnabled: boolean;
};

export function AssetRow({
  value,
  index,
  count,
  busy,
  onChange,
  onMove,
  onMakePrimary,
  onRemove,
}: {
  value: AssetRowValue;
  index: number;
  count: number;
  busy?: boolean;
  onChange: (patch: Partial<AssetRowValue>) => void;
  onMove: (delta: number) => void;
  onMakePrimary: () => void;
  onRemove: () => void;
}) {
  const preview = value.previewUrl ?? (value.assetType === "image" ? value.url : null);

  return (
    <li className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-start gap-3">
        {preview ? (
          <img
            src={preview}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-ink-soft">
            <Link2 className="h-5 w-5" />
          </span>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-ink-soft">
              {ASSET_TYPE_LABELS[value.assetType]}
            </span>
            {index === 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-soft">
                <Star className="h-3 w-3" /> Leads the page
              </span>
            )}
            {value.byteSize ? (
              <span className="text-[11px] text-ink-muted">{formatBytes(value.byteSize)}</span>
            ) : null}
          </div>

          <Input
            value={value.caption}
            onChange={(e) => onChange({ caption: e.target.value })}
            placeholder="Caption (optional)"
            className="h-8 text-sm"
          />
          {value.assetType === "image" && (
            <Input
              value={value.alt}
              onChange={(e) => onChange({ alt: e.target.value })}
              placeholder="Alt text — describe the image"
              className="h-8 text-sm"
            />
          )}
          <p className="truncate text-xs text-ink-muted">{value.url}</p>

          {value.hosted && (
            <label className="flex items-center gap-2 text-xs text-ink-soft">
              <Switch
                checked={value.downloadEnabled}
                onCheckedChange={(v) => onChange({ downloadEnabled: v })}
              />
              Allow downloads
            </label>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <Button
            type="button" variant="ghost" size="icon" className="h-7 w-7"
            disabled={busy || index === 0} aria-label="Move up" onClick={() => onMove(-1)}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button" variant="ghost" size="icon" className="h-7 w-7"
            disabled={busy || index === count - 1} aria-label="Move down" onClick={() => onMove(1)}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          {index !== 0 && (
            <Button
              type="button" variant="ghost" size="icon" className="h-7 w-7"
              disabled={busy} aria-label="Make this lead the page" onClick={onMakePrimary}
            >
              <Star className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button" variant="ghost" size="icon"
            className="h-7 w-7 text-ink-muted hover:text-destructive"
            disabled={busy} aria-label="Remove" onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}
