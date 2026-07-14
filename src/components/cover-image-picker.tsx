import { useRef, useState } from "react";
import { ChevronDown, Loader2, Upload, ImageIcon, Trash2, Check } from "lucide-react";
import { uploadToBucket } from "@/lib/storage";
import { resizeImageToJpeg } from "@/lib/image-resize";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_EDGE = 2048;

export type CoverWorkOption = {
  id: string;
  title: string;
  cover_url: string | null;
};

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
  onWorkChange?: (workId: string | null) => void;
  works: CoverWorkOption[];
  worksLoading?: boolean;
};

export function CoverImagePicker({ value, onChange, onWorkChange, works, worksLoading }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const worksWithCover = works.filter((w) => !!w.cover_url);

  async function handleFile(file: File | undefined) {
    if (!file || !user) return;
    if (file.size > MAX_BYTES * 4) {
      return toast.error("Image too large. Max 12MB before resize.");
    }
    setUploading(true);
    try {
      const { blob } = await resizeImageToJpeg(file, MAX_EDGE, 0.82);
      const sized = blob.size > MAX_BYTES ? (await resizeImageToJpeg(file, 1600, 0.78)).blob : blob;
      const out = sized instanceof File
        ? sized
        : new File([sized], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
      const url = await uploadToBucket("covers", user.id, out);
      onChange(url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative w-full overflow-hidden rounded-2xl border border-dashed border-border bg-surface-2 aspect-[16/6]">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
            {uploading ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</span>
            ) : (
              <span>No cover yet</span>
            )}
          </div>
        )}

        <div className="absolute right-2 top-2 flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-ink shadow-soft backdrop-blur hover:bg-background"
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                {value ? "Change cover" : "Add cover"}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Upload image
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPickerOpen(true)}>
                <ImageIcon className="mr-2 h-4 w-4" />
                Select from a Work
              </DropdownMenuItem>
              {value && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => onChange(null)} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove cover
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Select a cover from your Gallery</DialogTitle>
          </DialogHeader>

          {worksLoading ? (
            <div className="py-10 text-center text-sm text-ink-muted">Loading your Gallery…</div>
          ) : worksWithCover.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
              Post to Gallery with a cover image first to use this option.
            </div>
          ) : (
            <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
              {worksWithCover.map((w) => {
                const selected = value === w.cover_url;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      onChange(w.cover_url);
                      setPickerOpen(false);
                    }}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border bg-surface text-left transition hover:shadow-soft",
                      selected ? "border-ink ring-2 ring-ink" : "border-border hover:border-ink/30",
                    )}
                  >
                    <div className="aspect-[16/9] w-full overflow-hidden bg-surface-2">
                      <img src={w.cover_url!} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-2">
                      <span className="truncate text-xs text-ink">{w.title}</span>
                      {selected && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-ink" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
