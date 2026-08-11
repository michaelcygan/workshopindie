import { useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { updateGroup } from "@/lib/group-admin.functions";
import { resizeImageToJpeg } from "@/lib/image-resize";
import { uploadToBucket } from "@/lib/storage";

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_GIF_BYTES = 8 * 1024 * 1024;

type Target = "cover" | "avatar";

/**
 * Admin-only photo swap for a Group's banner or avatar, in place on the Group
 * page. The UI gate is convenience — `updateGroup` asserts the admin role
 * server-side, so nothing here is the security boundary.
 */
export function GroupPhotoEditor({
  groupId,
  target,
  currentUrl,
  className,
}: {
  groupId: string;
  target: Target;
  currentUrl: string | null;
  className?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const save = useServerFn(updateGroup);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isCover = target === "cover";
  const maxEdge = isCover ? 2048 : 800;

  async function commit(url: string | null) {
    await save({ data: isCover ? { id: groupId, cover_url: url } : { id: groupId, avatar_url: url } });
    await qc.invalidateQueries({ queryKey: ["group", groupId] });
    await router.invalidate();
  }

  async function handleFile(file: File | undefined) {
    if (!file || !user) return;
    const isGif = file.type === "image/gif" || /\.gif$/i.test(file.name);
    if (isGif) {
      if (file.size > MAX_GIF_BYTES) {
        toast.error("GIF too large. Max 8MB — try a shorter or smaller GIF.");
        return;
      }
    } else if (file.size > MAX_BYTES * 4) {
      toast.error("Image too large. Max 12MB before resize.");
      return;
    }
    setBusy(true);
    try {
      let out: File;
      if (isGif) {
        out = file;
      } else {
        const { blob } = await resizeImageToJpeg(file, maxEdge, 0.82);
        const sized =
          blob.size > MAX_BYTES ? (await resizeImageToJpeg(file, Math.round(maxEdge * 0.8), 0.78)).blob : blob;
        out = new File([sized], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
      }
      const url = await uploadToBucket(isCover ? "covers" : "avatars", user.id, out);
      await commit(url);
      toast.success(isCover ? "Banner updated" : "Avatar updated");
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await commit(null);
      toast.success("Photo removed");
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={isCover ? "Edit banner photo" : "Edit group avatar"}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/75"
        }
      >
        {isCover ? <ImagePlus className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
        {isCover ? <span className="hidden sm:inline">Edit photo</span> : null}
      </button>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isCover ? "Group banner" : "Group avatar"}</DialogTitle>
            <DialogDescription>
              JPG, PNG or GIF. {isCover ? "Wide images look best." : "Square images look best."}
            </DialogDescription>
          </DialogHeader>

          <div
            className={`overflow-hidden rounded-xl border border-border bg-surface-2 ${
              isCover ? "aspect-[16/6]" : "mx-auto aspect-square w-40"
            }`}
          >
            {currentUrl ? (
              <img src={currentUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-xs text-ink-muted">
                No photo yet
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />

          <div className="flex items-center justify-between gap-2">
            <Button onClick={() => fileRef.current?.click()} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {busy ? "Working…" : "Upload photo"}
            </Button>
            {currentUrl && (
              <Button
                variant="ghost"
                onClick={() => void handleRemove()}
                disabled={busy}
                className="gap-2 text-ink-muted hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
