import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Film, FileText, ImagePlus, Link2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AssetRow, type AssetRowValue } from "@/components/work/asset-row";
import { extractWorkFromUrl } from "@/lib/works-import.functions";
import { normalizeUrl } from "@/lib/url-normalize";
import {
  downloadDefaultForLicense,
  inferAssetTypeFromUrl,
  validateUpload,
  type WorkAssetType,
} from "@/lib/work-assets";

/**
 * A staged version of the assets editor for the creation flow.
 *
 * Nothing here touches storage or the database: a Work doesn't exist yet when
 * the creator is choosing its media. Files are held in memory with object-URL
 * previews and uploaded by the publish pipeline once a Work row exists.
 */
export type StagedAsset = AssetRowValue & {
  key: string;
  file?: File;
  mime?: string;
  /** Original URL before embed resolution, kept for provenance. */
  sourceUrl?: string;
};

export type WorkMediaComposerProps = {
  items: StagedAsset[];
  onChange: (next: StagedAsset[]) => void;
  license?: string | null;
  className?: string;
};

const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.avif";
const FILE_ACCEPT = ".pdf,.csv,.tsv,.json,.geojson,.glb,.gltf,.stl,.zip,.txt,.md";

export function WorkMediaComposer({ items, onChange, license, className }: WorkMediaComposerProps) {
  const [busy, setBusy] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const extract = useServerFn(extractWorkFromUrl);

  function addFiles(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    const added: StagedAsset[] = [];
    for (const file of list) {
      const check = validateUpload(file);
      if (!check.ok) {
        toast.error(check.reason);
        continue;
      }
      added.push({
        key: crypto.randomUUID(),
        assetType: check.type,
        url: file.name,
        previewUrl: check.type === "image" ? URL.createObjectURL(file) : null,
        caption: "",
        alt: "",
        byteSize: file.size,
        hosted: true,
        downloadEnabled: downloadDefaultForLicense(license),
        file,
        mime: check.mime,
      });
    }
    if (added.length > 0) onChange([...items, ...added]);
    if (imageRef.current) imageRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
  }

  async function addUrl(raw: string, expect: "media" | "any") {
    const url = normalizeUrl(raw.trim());
    if (!url) {
      toast.error("That doesn't look like a link.");
      return;
    }
    setBusy(true);
    let finalUrl = url;
    let assetType: WorkAssetType = "external";
    try {
      assetType = inferAssetTypeFromUrl(url);
    } catch {
      assetType = "external";
    }
    try {
      // Resolve watch pages into their embeddable form so the viewer can play them.
      const meta = await extract({ data: { url } });
      if (meta.embed_url) finalUrl = meta.embed_url;
      if (meta.provider === "github") assetType = "repository";
    } catch {
      // A resolver hiccup shouldn't stop someone adding a plain link.
    } finally {
      setBusy(false);
    }

    if (expect === "media" && assetType !== "video" && assetType !== "audio") {
      toast.message("Added as a link — Workshop couldn't recognise that as a video or audio host.");
    }

    onChange([
      ...items,
      {
        key: crypto.randomUUID(),
        assetType,
        url: finalUrl,
        previewUrl: null,
        caption: "",
        alt: "",
        byteSize: null,
        hosted: false,
        downloadEnabled: false,
        sourceUrl: finalUrl === url ? undefined : url,
      },
    ]);
    setLinkUrl("");
    setMediaUrl("");
  }

  function move(index: number, delta: number) {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function makePrimary(index: number) {
    if (index === 0) return;
    const next = [...items];
    const [item] = next.splice(index, 1);
    onChange([item, ...next]);
  }

  function remove(index: number) {
    const item = items[index];
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div>
        <Label>Work media</Label>
        <p className="mt-1 text-sm text-ink-muted">
          Add the files and links that make up this Work. The first item leads the page.
        </p>
      </div>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <AssetRow
              key={item.key}
              value={item}
              index={i}
              count={items.length}
              busy={busy}
              onChange={(patch) =>
                onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
              }
              onMove={(d) => move(i, d)}
              onMakePrimary={() => makePrimary(i)}
              onRemove={() => remove(i)}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={imageRef} type="file" multiple accept={IMAGE_ACCEPT} className="sr-only"
          onChange={(e) => addFiles(e.target.files)}
        />
        <input
          ref={fileRef} type="file" multiple accept={FILE_ACCEPT} className="sr-only"
          onChange={(e) => addFiles(e.target.files)}
        />
        <Button type="button" variant="outline" size="sm" className="rounded-md"
          onClick={() => imageRef.current?.click()}>
          <ImagePlus className="mr-2 h-4 w-4" /> Photos
        </Button>
        <Button type="button" variant="outline" size="sm" className="rounded-md"
          onClick={() => fileRef.current?.click()}>
          <FileText className="mr-2 h-4 w-4" /> Reader / file
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Film className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); void addUrl(mediaUrl, "media"); }
              }}
              placeholder="Video or audio link"
              className="h-9 pl-9"
            />
          </div>
          <Button type="button" variant="ghost" size="sm" className="rounded-md"
            disabled={busy || !mediaUrl.trim()} onClick={() => void addUrl(mediaUrl, "media")}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); void addUrl(linkUrl, "any"); }
              }}
              placeholder="Repo, demo, dataset, site"
              className="h-9 pl-9"
            />
          </div>
          <Button type="button" variant="ghost" size="sm" className="rounded-md"
            disabled={busy || !linkUrl.trim()} onClick={() => void addUrl(linkUrl, "any")}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <p className="text-xs text-ink-muted">
        Workshop hosts images up to 8 MB and documents up to 25 MB. Anything larger lives on your own host — add the
        link instead. Video and audio are embedded from where they already live.
      </p>
    </section>
  );
}

/** Frees the object URLs a staged set is holding. */
export function releaseStagedAssets(items: StagedAsset[]) {
  for (const item of items) if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
}
