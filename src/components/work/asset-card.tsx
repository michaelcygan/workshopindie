import { Download, ExternalLink, FileText, Github, Package, Table2, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ASSET_TYPE_LABELS, formatBytes, type DerivedWorkAsset, type WorkAsset, type WorkAssetType } from "@/lib/work-assets";

const ICONS: Partial<Record<WorkAssetType, typeof FileText>> = {
  document: FileText,
  repository: Github,
  dataset: Table2,
  model_3d: Boxes,
  file: Package,
  external: ExternalLink,
};

/**
 * The quiet renderer: anything Workshop shouldn't try to display inline still
 * gets a dignified, downloadable presence beneath the Work.
 */
export function AssetCard({
  asset,
  className,
}: {
  asset: WorkAsset | DerivedWorkAsset;
  className?: string;
}) {
  const Icon = ICONS[asset.asset_type] ?? Package;
  const label = asset.label || defaultLabel(asset);
  const meta = [ASSET_TYPE_LABELS[asset.asset_type], formatBytes(asset.byte_size)].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition hover:border-ink/25",
        className,
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-soft">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{label}</p>
        <p className="truncate text-xs text-ink-muted">{asset.caption || meta}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <a href={asset.url} target="_blank" rel="noreferrer noopener">
          <Button variant="ghost" size="sm" className="rounded-md">
            Open <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </Button>
        </a>
        {asset.download_enabled && asset.storage_path && (
          <a href={asset.url} download target="_blank" rel="noreferrer noopener" aria-label={`Download ${label}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md">
              <Download className="h-4 w-4" />
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

function defaultLabel(asset: WorkAsset | DerivedWorkAsset) {
  if (asset.asset_type === "repository") {
    try {
      const u = new URL(asset.url);
      return `${u.hostname.replace(/^www\./, "")}${u.pathname}`;
    } catch {
      return asset.url;
    }
  }
  const last = asset.url.split("?")[0].split("/").pop();
  return last ? decodeURIComponent(last) : ASSET_TYPE_LABELS[asset.asset_type];
}
