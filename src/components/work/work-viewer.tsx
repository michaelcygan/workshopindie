import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { EmbedPlayer, providerFromUrl } from "@/components/embed-player";
import { ImageViewer } from "@/components/work/image-viewer";
import { AssetCard } from "@/components/work/asset-card";
import { DocumentFallback } from "@/components/work/document-viewer";
import { cn } from "@/lib/utils";
import type { DerivedWorkAsset, WorkAsset } from "@/lib/work-assets";
import { primaryAsset } from "@/lib/work-assets";

const DocumentViewer = lazy(() =>
  import("@/components/work/document-viewer").then((m) => ({ default: m.DocumentViewer })),
);
const ModelViewer = lazy(() => import("@/components/work/model-viewer"));

type Asset = WorkAsset | DerivedWorkAsset;

function ViewerFallback() {
  return (
    <div className="flex aspect-video items-center justify-center rounded-xl border border-border bg-surface-2 text-ink-muted">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

/**
 * WorkViewer decides *how* to render a Work from its assets alone.
 *
 * It never asks what discipline the Work belongs to — a screenplay, a research
 * paper and a zine are all `document`; a painting and a photograph are both
 * `image`. That's what keeps the model from sprouting a viewer per medium.
 *
 * Layout rule: one hero presentation, then supporting assets. Images collapse
 * into a single gallery so a photo essay doesn't become fifteen stacked heroes.
 */
export function WorkViewer({
  assets,
  title,
  coverUrl,
  className,
}: {
  assets: Asset[];
  title: string;
  coverUrl?: string | null;
  className?: string;
}) {
  if (assets.length === 0) {
    if (!coverUrl) return null;
    return (
      <div className={cn("overflow-hidden rounded-xl border border-border bg-surface-2", className)}>
        <img src={coverUrl} alt={title} className="w-full object-cover" loading="eager" decoding="async" />
      </div>
    );
  }

  const hero = primaryAsset(assets);
  const images = assets.filter((a) => a.asset_type === "image");
  const heroIsImage = hero?.asset_type === "image";

  // Everything that isn't the hero and isn't part of the image gallery.
  const rest = assets.filter((a) => a.id !== hero?.id && !(heroIsImage && a.asset_type === "image"));
  const inlineRest = rest.filter((a) => a.asset_type === "video" || a.asset_type === "audio");
  const cards = rest.filter((a) => a.asset_type !== "video" && a.asset_type !== "audio");

  return (
    <div className={cn("space-y-4", className)}>
      {heroIsImage ? (
        <ImageViewer images={images} title={title} />
      ) : hero ? (
        <AssetSurface asset={hero} title={title} />
      ) : null}

      {inlineRest.map((asset) => (
        <AssetSurface key={asset.id} asset={asset} title={asset.label || title} />
      ))}

      {cards.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {cards.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Renders one asset in its native presentation. */
function AssetSurface({ asset, title }: { asset: Asset; title: string }) {
  switch (asset.asset_type) {
    case "image":
      return <ImageViewer images={[asset]} title={title} />;

    case "video":
    case "audio": {
      const provider = providerFromUrl(asset.url);
      const player = <EmbedPlayer url={asset.url} provider={provider} title={title} />;
      // An unsupported host still deserves a link rather than an empty slot.
      return player && provider ? player : <AssetCard asset={asset} />;
    }

    case "document":
      return (
        <Suspense fallback={<ViewerFallback />}>
          <DocumentErrorBoundaryless asset={asset} title={title} />
        </Suspense>
      );

    case "model_3d":
      return (
        <Suspense fallback={<ViewerFallback />}>
          <ModelViewer url={asset.url} title={title} />
        </Suspense>
      );

    default:
      return <AssetCard asset={asset} />;
  }
}

/** PDFs that aren't PDFs shouldn't reach the engine at all. */
function DocumentErrorBoundaryless({ asset, title }: { asset: Asset; title: string }) {
  const isPdf = asset.mime_type === "application/pdf" || /\.pdf($|\?)/i.test(asset.url);
  if (!isPdf) return <DocumentFallback url={asset.url} downloadEnabled={asset.download_enabled} />;
  return <DocumentViewer url={asset.url} title={title} downloadEnabled={asset.download_enabled} />;
}
