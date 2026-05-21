import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  createStreamUploadUrl,
  finalizeStreamUpload,
} from "@/lib/stream-uploads.functions";

export type StreamUploadResult = {
  uid: string;
  hlsUrl: string;
  thumbnailUrl: string | null;
};

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB safety cap

export function VideoUploadButton({
  onUploaded,
  maxDurationSeconds = 600,
}: {
  onUploaded: (result: StreamUploadResult) => void;
  maxDurationSeconds?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const createUrl = useServerFn(createStreamUploadUrl);
  const finalize = useServerFn(finalizeStreamUpload);

  async function handleFile(file: File) {
    if (!file.type.startsWith("video/")) {
      return toast.error("That doesn't look like a video file.");
    }
    if (file.size > MAX_BYTES) {
      return toast.error("Video is too large (max 500 MB).");
    }

    setBusy(true);
    setProgress("Preparing upload…");

    try {
      const { uploadURL, uid } = await createUrl({
        data: { maxDurationSeconds },
      });

      setProgress("Uploading…");
      const form = new FormData();
      form.append("file", file);
      const upRes = await fetch(uploadURL, { method: "POST", body: form });
      if (!upRes.ok) throw new Error(`Upload failed (${upRes.status})`);

      setProgress("Processing…");
      // Poll for readiness (up to ~2 min)
      let ready = false;
      let hls: string | null = null;
      let thumb: string | null = null;
      for (let i = 0; i < 40; i++) {
        const res = await finalize({ data: { uid } });
        if (res.ready && res.hlsUrl) {
          ready = true;
          hls = res.hlsUrl;
          thumb = res.thumbnailUrl;
          break;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!ready || !hls) {
        throw new Error("Video is still processing. Try again in a minute.");
      }
      toast.success("Video ready");
      onUploaded({ uid, hlsUrl: hls, thumbnailUrl: thumb });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink underline underline-offset-2 disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {progress ?? "Uploading…"}
          </>
        ) : (
          <>
            <Upload className="h-3.5 w-3.5" />
            Or upload a video file
          </>
        )}
      </button>
    </>
  );
}
