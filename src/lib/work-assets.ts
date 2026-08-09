/**
 * Work assets — the presentation layer underneath a Work.
 *
 * A Work is the published object; assets are how the Work is experienced.
 * Assets are never standalone Workshop entities: no URLs, no follows, no
 * comments, no discovery. They exist only to render the Work well.
 *
 * `asset_type` describes *rendering behaviour* (how to show it). The Work's
 * Field (category) and Format (subtype) describe *meaning*. A screenplay and a
 * research paper are both `document`; a painting and a photograph are both
 * `image`.
 */
import { supabase } from "@/integrations/supabase/client";
import { providerFromUrl } from "@/components/embed-player";

export const WORK_ASSET_TYPES = [
  "image",
  "document",
  "video",
  "audio",
  "repository",
  "file",
  "dataset",
  "model_3d",
  "external",
] as const;

export type WorkAssetType = (typeof WORK_ASSET_TYPES)[number];

export type WorkAsset = {
  id: string;
  work_id: string;
  asset_type: WorkAssetType;
  url: string;
  storage_path: string | null;
  label: string | null;
  caption: string | null;
  mime_type: string | null;
  byte_size: number | null;
  sort_order: number;
  is_primary: boolean;
  download_enabled: boolean;
  metadata: Record<string, unknown>;
};

/** Rows synthesised from legacy Work columns; they have no database identity. */
export type DerivedWorkAsset = WorkAsset & { derived: true };

export const ASSET_TYPE_LABELS: Record<WorkAssetType, string> = {
  image: "Image",
  document: "Document",
  video: "Video",
  audio: "Audio",
  repository: "Repository",
  file: "File",
  dataset: "Dataset",
  model_3d: "3D model",
  external: "Link",
};

// ---------------------------------------------------------------------------
// Upload guardrails — Workshop is a portfolio layer, not file hosting.
// Anything bigger belongs on the creator's own host, linked as an external asset.
// ---------------------------------------------------------------------------

export const ASSET_SIZE_LIMITS: Record<WorkAssetType, number> = {
  image: 8 * 1024 * 1024,
  document: 25 * 1024 * 1024,
  video: 0, // embeds only
  audio: 0, // embeds only
  repository: 0, // links only
  file: 25 * 1024 * 1024,
  dataset: 25 * 1024 * 1024,
  model_3d: 25 * 1024 * 1024,
  external: 0,
};

/** Extension → (asset type, mime) allowlist. Never trust browser MIME alone. */
const EXTENSION_MAP: Record<string, { type: WorkAssetType; mime: string }> = {
  jpg: { type: "image", mime: "image/jpeg" },
  jpeg: { type: "image", mime: "image/jpeg" },
  png: { type: "image", mime: "image/png" },
  webp: { type: "image", mime: "image/webp" },
  gif: { type: "image", mime: "image/gif" },
  avif: { type: "image", mime: "image/avif" },
  pdf: { type: "document", mime: "application/pdf" },
  csv: { type: "dataset", mime: "text/csv" },
  tsv: { type: "dataset", mime: "text/tab-separated-values" },
  json: { type: "dataset", mime: "application/json" },
  geojson: { type: "dataset", mime: "application/geo+json" },
  glb: { type: "model_3d", mime: "model/gltf-binary" },
  gltf: { type: "model_3d", mime: "model/gltf+json" },
  stl: { type: "file", mime: "model/stl" },
  zip: { type: "file", mime: "application/zip" },
  txt: { type: "file", mime: "text/plain" },
  md: { type: "file", mime: "text/markdown" },
};

export const ACCEPTED_UPLOAD_EXTENSIONS = Object.keys(EXTENSION_MAP);

export function extensionOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** Infer how a dropped file should be rendered. Returns null when unsupported. */
export function inferAssetFromFile(file: File): { type: WorkAssetType; mime: string } | null {
  const hit = EXTENSION_MAP[extensionOf(file.name)];
  if (!hit) return null;
  return hit;
}

export function validateUpload(file: File): { ok: true; type: WorkAssetType; mime: string } | { ok: false; reason: string } {
  const inferred = inferAssetFromFile(file);
  if (!inferred) {
    return { ok: false, reason: `Workshop can't host .${extensionOf(file.name) || "that"} files. Host it elsewhere and add the link instead.` };
  }
  const limit = ASSET_SIZE_LIMITS[inferred.type];
  if (limit > 0 && file.size > limit) {
    return {
      ok: false,
      reason: `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(limit)}. Host it elsewhere and add the link instead.`,
    };
  }
  return { ok: true, ...inferred };
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

/** Infer an asset type for a pasted link. */
export function inferAssetTypeFromUrl(url: string): WorkAssetType {
  const provider = providerFromUrl(url);
  if (provider === "github") return "repository";
  if (provider === "youtube" || provider === "vimeo" || provider === "tiktok") return "video";
  if (provider === "soundcloud" || provider === "bandcamp" || provider === "spotify") return "audio";
  const ext = extensionOf(new URL(url, "https://x.invalid").pathname);
  const hit = EXTENSION_MAP[ext];
  if (hit) return hit.type;
  return "external";
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/**
 * Assets live in the existing public `work-covers` bucket under an `assets/`
 * prefix. The bucket's write policy scopes the first path segment to the
 * uploader's user id; reads are public, which is what a published Work needs
 * (signed URLs would expire out from under shared links and crawlers).
 */
export const ASSET_BUCKET = "work-covers";

export function assetStoragePath(userId: string, workId: string, filename: string) {
  const ext = extensionOf(filename) || "bin";
  return `${userId}/assets/${workId}/${crypto.randomUUID()}.${ext}`;
}

export async function uploadWorkAssetFile(opts: {
  userId: string;
  workId: string;
  file: File;
  mime: string;
}): Promise<{ url: string; storage_path: string }> {
  const path = assetStoragePath(opts.userId, opts.workId, opts.file.name);
  const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, opts.file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: opts.mime,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, storage_path: path };
}

export async function removeWorkAssetFile(storagePath: string | null) {
  if (!storagePath) return;
  await supabase.storage.from(ASSET_BUCKET).remove([storagePath]);
}

// ---------------------------------------------------------------------------
// Reads / writes
// ---------------------------------------------------------------------------

const SELECT =
  "id,work_id,asset_type,url,storage_path,label,caption,mime_type,byte_size,sort_order,is_primary,download_enabled,metadata";

export async function listWorkAssets(workId: string): Promise<WorkAsset[]> {
  const { data, error } = await supabase
    .from("work_assets")
    .select(SELECT)
    .eq("work_id", workId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as WorkAsset[];
}

export type NewWorkAsset = {
  work_id: string;
  created_by: string;
  asset_type: WorkAssetType;
  url: string;
  storage_path?: string | null;
  label?: string | null;
  caption?: string | null;
  mime_type?: string | null;
  byte_size?: number | null;
  sort_order?: number;
  is_primary?: boolean;
  download_enabled?: boolean;
  metadata?: Record<string, unknown>;
};

export async function insertWorkAssets(rows: NewWorkAsset[]) {
  if (rows.length === 0) return [];
  const { data, error } = await supabase.from("work_assets").insert(rows).select(SELECT);
  if (error) throw error;
  return (data ?? []) as unknown as WorkAsset[];
}

export async function updateWorkAsset(id: string, patch: Partial<Omit<WorkAsset, "id" | "work_id">>) {
  const { error } = await supabase.from("work_assets").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteWorkAsset(asset: Pick<WorkAsset, "id" | "storage_path">) {
  const { error } = await supabase.from("work_assets").delete().eq("id", asset.id);
  if (error) throw error;
  await removeWorkAssetFile(asset.storage_path).catch(() => {});
}

/** Persist a new ordering. One primary per Work is enforced by a unique index. */
export async function reorderWorkAssets(workId: string, orderedIds: string[]) {
  // Clear primary first so the partial unique index can never see two.
  await supabase.from("work_assets").update({ is_primary: false }).eq("work_id", workId);
  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await supabase
      .from("work_assets")
      .update({ sort_order: i, is_primary: i === 0 })
      .eq("id", orderedIds[i]);
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Legacy adapter — every existing Work keeps rendering unchanged
// ---------------------------------------------------------------------------

type LegacyWork = {
  id: string;
  title: string;
  cover_url: string | null;
  primary_url: string | null;
  embed_url: string | null;
};

function derived(work_id: string, partial: Omit<DerivedWorkAsset, "derived" | "work_id" | "id"> & { id: string }): DerivedWorkAsset {
  return { ...partial, work_id, derived: true } as DerivedWorkAsset;
}

/**
 * Merge stored assets with assets implied by the Work's legacy columns.
 *
 * Nothing is migrated in the database: `embed_url` / `primary_url` /
 * `cover_url` remain authoritative until a creator adds real assets. If a Work
 * has stored assets, those win for the primary slot and the legacy embed is
 * appended as a supporting asset only when it isn't already represented.
 */
export function resolveWorkAssets(work: LegacyWork, stored: WorkAsset[]): (WorkAsset | DerivedWorkAsset)[] {
  const out: (WorkAsset | DerivedWorkAsset)[] = [...stored].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  const urls = new Set(out.map((a) => a.url));

  if (work.embed_url && !urls.has(work.embed_url)) {
    const provider = providerFromUrl(work.embed_url);
    const isAudio = provider === "soundcloud" || provider === "bandcamp" || provider === "spotify";
    out.unshift(
      derived(work.id, {
        id: `legacy-embed-${work.id}`,
        asset_type: isAudio ? "audio" : "video",
        url: work.embed_url,
        storage_path: null,
        label: work.title,
        caption: null,
        mime_type: null,
        byte_size: null,
        sort_order: -2,
        is_primary: out.length === 0,
        download_enabled: false,
        metadata: {},
      }),
    );
    urls.add(work.embed_url);
  }

  if (work.primary_url && !urls.has(work.primary_url)) {
    const type = safeInferType(work.primary_url);
    if (type === "repository") {
      out.push(
        derived(work.id, {
          id: `legacy-source-${work.id}`,
          asset_type: "repository",
          url: work.primary_url,
          storage_path: null,
          label: null,
          caption: null,
          mime_type: null,
          byte_size: null,
          sort_order: 999,
          is_primary: false,
          download_enabled: false,
          metadata: {},
        }),
      );
    }
  }

  return out;
}

function safeInferType(url: string): WorkAssetType {
  try {
    return inferAssetTypeFromUrl(url);
  } catch {
    return "external";
  }
}

/** The asset that should headline the Work page, if any. */
export function primaryAsset(assets: (WorkAsset | DerivedWorkAsset)[]) {
  return assets.find((a) => a.is_primary) ?? assets[0] ?? null;
}

/** Download defaults follow the Work's license unless the creator overrode it. */
export function downloadDefaultForLicense(license: string | null | undefined): boolean {
  return license === "cc_by";
}
