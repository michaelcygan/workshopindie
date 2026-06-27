import { useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { uploadToBucket } from "@/lib/storage";
import { resizeImageToJpeg } from "@/lib/image-resize";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
  bucket: "avatars" | "covers" | "work-covers";
  aspect?: "square" | "video" | "portrait" | "wide";
  label?: string;
  className?: string;
};

const aspectClass = {
  square: "aspect-square",
  video: "aspect-video",
  portrait: "aspect-[4/5]",
  wide: "aspect-[16/6]",
} as const;

// v1 storage guardrails — keep portfolios cheap to host.
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_EDGE = 2048;

export function ImageUpload({ value, onChange, bucket, aspect = "square", label = "Upload image", className }: Props) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file || !user) return;
    if (file.size > MAX_BYTES * 4) {
      return toast.error("Image too large. Max 12MB before resize.");
    }
    setUploading(true);
    try {
      // Always downscale to ≤2048px JPEG so storage stays bounded.
      const { blob } = await resizeImageToJpeg(file, MAX_EDGE, 0.82);
      const sized = blob.size > MAX_BYTES
        ? (await resizeImageToJpeg(file, 1600, 0.78)).blob
        : blob;
      const out = sized instanceof File
        ? sized
        : new File([sized], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
      const url = await uploadToBucket(bucket, user.id, out);
      onChange(url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={cn("relative w-full overflow-hidden rounded-2xl border border-dashed border-border bg-surface-2", aspectClass[aspect], className)}>
      {value ? (
        <>
          <img src={value} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-ink shadow-soft hover:bg-background"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm text-ink-muted hover:bg-muted/40"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          <span>{uploading ? "Uploading…" : label}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
