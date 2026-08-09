import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Link2, Loader2, Plus, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  ASSET_TYPE_LABELS,
  deleteWorkAsset,
  downloadDefaultForLicense,
  formatBytes,
  inferAssetTypeFromUrl,
  insertWorkAssets,
  listWorkAssets,
  reorderWorkAssets,
  updateWorkAsset,
  uploadWorkAssetFile,
  validateUpload,
  type WorkAsset,
} from "@/lib/work-assets";

/**
 * Authoring surface for a Work's presentation assets.
 *
 * Deliberately quiet: creators aren't asked to classify anything. They add
 * files or links; Workshop infers how to render them. The first asset is the
 * one that headlines the page, so ordering is the only real control.
 */
export function WorkAssetsEditor({
  workId,
  userId,
  license,
  className,
}: {
  workId: string;
  userId: string;
  license: string | null | undefined;
  className?: string;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["work-assets", workId],
    queryFn: () => listWorkAssets(workId),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["work-assets", workId] });

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    let added = 0;
    try {
      for (const file of Array.from(files)) {
        const check = validateUpload(file);
        if (!check.ok) {
          toast.error(check.reason);
          continue;
        }
        const { url, storage_path } = await uploadWorkAssetFile({ userId, workId, file, mime: check.mime });
        await insertWorkAssets([
          {
            work_id: workId,
            created_by: userId,
            asset_type: check.type,
            url,
            storage_path,
            label: file.name,
            mime_type: check.mime,
            byte_size: file.size,
            sort_order: assets.length + added,
            is_primary: assets.length + added === 0,
            download_enabled: downloadDefaultForLicense(license),
          },
        ]);
        added += 1;
      }
      if (added > 0) {
        await refresh();
        toast.success(added === 1 ? "Asset added" : `${added} assets added`);
      }
    } catch {
      toast.error("Couldn't upload that. Try again.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onAddLink() {
    const raw = linkUrl.trim();
    if (!raw) return;
    let normalized: string;
    try {
      normalized = new URL(raw.startsWith("http") ? raw : `https://${raw}`).toString();
    } catch {
      toast.error("That doesn't look like a link.");
      return;
    }
    setBusy(true);
    try {
      await insertWorkAssets([
        {
          work_id: workId,
          created_by: userId,
          asset_type: inferAssetTypeFromUrl(normalized),
          url: normalized,
          sort_order: assets.length,
          is_primary: assets.length === 0,
          download_enabled: false,
        },
      ]);
      setLinkUrl("");
      await refresh();
    } catch {
      toast.error("Couldn't add that link.");
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, delta: number) {
    const next = [...assets];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    try {
      await reorderWorkAssets(workId, next.map((a) => a.id));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function makePrimary(index: number) {
    if (index === 0) return;
    await move(index, -index);
  }

  async function remove(asset: WorkAsset) {
    setBusy(true);
    try {
      await deleteWorkAsset(asset);
      await refresh();
    } catch {
      toast.error("Couldn't remove that asset.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(asset: WorkAsset, changes: Partial<WorkAsset>) {
    try {
      await updateWorkAsset(asset.id, changes);
      await refresh();
    } catch {
      toast.error("Couldn't save that change.");
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <Label>Assets</Label>
        <p className="mt-1 text-sm text-ink-muted">
          Images, documents, links — however this work is best experienced. The first one headlines the page.
        </p>
      </div>

      {isLoading ? (
        <div className="h-16 animate-pulse rounded-xl bg-surface-2" />
      ) : assets.length > 0 ? (
        <ul className="space-y-2">
          {assets.map((asset, i) => (
            <li key={asset.id} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-start gap-3">
                <Thumb asset={asset} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-ink-soft">
                      {ASSET_TYPE_LABELS[asset.asset_type]}
                    </span>
                    {i === 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-soft">
                        <Star className="h-3 w-3" /> Leads the page
                      </span>
                    )}
                    {asset.byte_size ? (
                      <span className="text-[11px] text-ink-muted">{formatBytes(asset.byte_size)}</span>
                    ) : null}
                  </div>
                  <Input
                    defaultValue={asset.caption ?? ""}
                    placeholder="Caption (optional)"
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (asset.caption ?? null)) void patch(asset, { caption: v });
                    }}
                    className="h-8 text-sm"
                  />
                  <p className="truncate text-xs text-ink-muted">{asset.url}</p>
                  {asset.storage_path && (
                    <label className="flex items-center gap-2 text-xs text-ink-soft">
                      <Switch
                        checked={asset.download_enabled}
                        onCheckedChange={(v) => void patch(asset, { download_enabled: v })}
                      />
                      Allow downloads
                    </label>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy || i === 0}
                    aria-label="Move up" onClick={() => void move(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy || i === assets.length - 1}
                    aria-label="Move down" onClick={() => void move(i, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  {i !== 0 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy}
                      aria-label="Make this lead the page" onClick={() => void makePrimary(i)}>
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-ink-muted hover:text-destructive"
                    disabled={busy} aria-label="Remove asset" onClick={() => void remove(asset)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-ink-muted">
          No assets yet — the cover image will be used on its own.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPTED_UPLOAD_EXTENSIONS.map((e) => `.${e}`).join(",")}
          className="sr-only"
          onChange={(e) => void onFiles(e.target.files)}
        />
        <Button type="button" variant="outline" size="sm" className="rounded-md" disabled={busy}
          onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Add files
        </Button>
        <div className="flex min-w-[240px] flex-1 items-center gap-2">
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onAddLink();
              }
            }}
            placeholder="Or paste a link — video, repo, anywhere it lives"
            className="h-9"
          />
          <Button type="button" variant="ghost" size="sm" className="rounded-md" disabled={busy || !linkUrl.trim()}
            onClick={() => void onAddLink()}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      </div>
      <p className="text-xs text-ink-muted">
        Workshop hosts images up to 8 MB and documents up to 25 MB. Anything larger lives on your own host — add the link
        instead.
      </p>
    </div>
  );
}

function Thumb({ asset }: { asset: WorkAsset }) {
  if (asset.asset_type === "image") {
    return (
      <img
        src={asset.url}
        alt=""
        className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-ink-soft">
      <Link2 className="h-5 w-5" />
    </span>
  );
}
