import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { uploadToBucket } from "@/lib/storage";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const MAX_BYTES = 8 * 1024 * 1024;

export function CoverImagePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!user) {
      toast.error("Sign in to upload.");
      return;
    }
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) {
      toast.error("Use a JPG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Max 8 MB.");
      return;
    }
    setBusy(true);
    try {
      const url = await uploadToBucket("covers", user.id, file);
      onChange(url);
    } catch (err) {
      toast.error((err as Error).message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Cover photo</Label>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink"
          onClick={() => setShowUrl((s) => !s)}
        >
          <LinkIcon className="h-3 w-3" /> {showUrl ? "Hide URL" : "Paste URL"}
        </button>
      </div>

      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-border">
          <img src={value} alt="Cover preview" className="h-40 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="rounded-full"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Replace"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-full text-white hover:bg-white/10"
              onClick={() => onChange("")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
          className={cn(
            "flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 text-ink-muted transition hover:border-primary/50 hover:text-ink",
            dragOver && "border-primary bg-primary/5 text-ink",
          )}
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              <div className="text-sm font-medium">Drop a photo, or click to upload</div>
              <div className="text-[11px]">JPG · PNG · WebP · up to 8 MB</div>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      {showUrl && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className="rounded-xl"
        />
      )}
    </div>
  );
}
