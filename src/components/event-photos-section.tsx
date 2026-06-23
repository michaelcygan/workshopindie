import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, Trash2, Maximize2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  listEventPhotos,
  recordEventPhoto,
  deleteEventPhoto,
  type EventPhoto,
} from "@/lib/event-photos.functions";
import { resizeImageToJpeg } from "@/lib/image-resize";

type Props = {
  eventId: string;
  /** When true, the viewer is RSVP'd going/maybe (or host) and can upload. */
  canUpload: boolean;
};

/**
 * Event photos surface — gallery + uploader. Renders during live + post.
 * Each photo is resized client-side to 1500px long edge / JPEG 0.82 before
 * upload to keep storage small. Resize failure falls back to original.
 */
export function EventPhotosSection({ eventId, canUpload }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listEventPhotos);
  const { data: photos } = useQuery({
    queryKey: ["event-photos", eventId],
    queryFn: () => listFn({ data: { event_id: eventId } }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const [lightbox, setLightbox] = useState<number | null>(null);

  const items = photos ?? [];

  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-soft">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-ink">Photos</h3>
          <p className="text-xs text-ink-muted">From people who were there.</p>
        </div>
        {canUpload && <PhotoUploader eventId={eventId} onUploaded={() => qc.invalidateQueries({ queryKey: ["event-photos", eventId] })} />}
      </header>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-background p-8 text-center text-sm text-ink-muted">
          No photos yet. {canUpload ? "Be first to drop one." : ""}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
            {items.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setLightbox(i)}
                className="group relative aspect-square overflow-hidden rounded-xl bg-muted"
              >
                {p.url ? (
                  <img
                    src={p.url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ink-muted">
                    <Camera className="h-5 w-5" />
                  </div>
                )}
              </button>
            ))}
          </div>
          {lightbox !== null && items[lightbox] && (
            <Lightbox
              items={items}
              index={lightbox}
              onClose={() => setLightbox(null)}
              onChange={setLightbox}
              currentUserId={user?.id ?? null}
              onDeleted={() => {
                setLightbox(null);
                qc.invalidateQueries({ queryKey: ["event-photos", eventId] });
              }}
            />
          )}
        </>
      )}
    </section>
  );
}

function PhotoUploader({ eventId, onUploaded }: { eventId: string; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuth();
  const recordFn = useServerFn(recordEventPhoto);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !user) return;
    const list = Array.from(files).slice(0, 20); // cap per batch
    setBusy(true);
    setProgress({ done: 0, total: list.length });
    let failed = 0;

    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      try {
        if (!file.type.startsWith("image/")) {
          failed++;
          continue;
        }
        const { blob, width, height, mime } = await resizeImageToJpeg(file, 1500, 0.82);
        const ext = mime === "image/jpeg" ? "jpg" : (file.name.split(".").pop()?.toLowerCase() ?? "jpg");
        const path = `${eventId}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("event-photos").upload(path, blob, {
          contentType: mime,
          cacheControl: "3600",
          upsert: false,
        });
        if (up.error) throw up.error;
        await recordFn({
          data: {
            event_id: eventId,
            storage_path: path,
            width: width || null,
            height: height || null,
          },
        });
      } catch (err) {
        console.error("photo upload failed", err);
        failed++;
      }
      setProgress({ done: i + 1, total: list.length });
    }

    setBusy(false);
    setProgress(null);
    if (failed === list.length) {
      toast.error("Upload failed");
    } else if (failed > 0) {
      toast.warning(`Uploaded ${list.length - failed} of ${list.length}`);
      onUploaded();
    } else {
      toast.success(`Added ${list.length} photo${list.length === 1 ? "" : "s"}`);
      onUploaded();
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        size="sm"
        className="rounded-full gap-1.5"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {progress ? `${progress.done}/${progress.total}` : "Uploading"}
          </>
        ) : (
          <>
            <Camera className="h-3.5 w-3.5" /> Add photos
          </>
        )}
      </Button>
    </>
  );
}

function Lightbox({
  items,
  index,
  onClose,
  onChange,
  currentUserId,
  onDeleted,
}: {
  items: EventPhoto[];
  index: number;
  onClose: () => void;
  onChange: (i: number) => void;
  currentUserId: string | null;
  onDeleted: () => void;
}) {
  const current = items[index];
  const deleteFn = useServerFn(deleteEventPhoto);
  const del = useMutation({
    mutationFn: () => deleteFn({ data: { id: current.id } }),
    onSuccess: () => {
      toast.success("Photo removed");
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canDelete = currentUserId && current.uploader_id === currentUserId;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4" onClick={onClose}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="relative max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
        {current.url && (
          <img src={current.url} alt="" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain" />
        )}
        <div className="mt-3 flex items-center justify-between text-xs text-white/70">
          <span>
            {current.uploader?.display_name ?? current.uploader?.username ?? "Someone"} ·{" "}
            {new Date(current.created_at).toLocaleString(undefined, { month: "short", day: "numeric" })}
          </span>
          <div className="flex items-center gap-2">
            <span>{index + 1} / {items.length}</span>
            {canDelete && (
              <button
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-white hover:bg-red-500/80 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </div>
        </div>
        {items.length > 1 && (
          <>
            <button
              onClick={() => onChange((index - 1 + items.length) % items.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-white hover:bg-white/20"
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              onClick={() => onChange((index + 1) % items.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-white hover:bg-white/20"
              aria-label="Next"
            >
              ›
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Fullscreen photo carousel — projector mode for the recap photos.
 * Companion to EventShowcaseProjectorButton.
 */
export function EventPhotosProjectorButton({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const listFn = useServerFn(listEventPhotos);
  const { data } = useQuery({
    queryKey: ["event-photos", eventId],
    queryFn: () => listFn({ data: { event_id: eventId } }),
    refetchInterval: open ? 30_000 : false,
    staleTime: 15_000,
    enabled: open,
  });

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="rounded-full gap-1.5"
        onClick={() => setOpen(true)}
        title="Project photos fullscreen"
      >
        <Maximize2 className="h-3.5 w-3.5" /> Slideshow
      </Button>
    );
  }
  return <PhotoSlideshow items={data ?? []} onClose={() => setOpen(false)} />;
}

function PhotoSlideshow({ items, onClose }: { items: EventPhoto[]; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const count = items.length;

  useEffect(() => {
    const el = containerRef.current;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => (count ? (i + 1) % count : 0));
      if (e.key === "ArrowLeft") setIndex((i) => (count ? (i - 1 + count) % count : 0));
    }
    window.addEventListener("keydown", onKey);
    const id = count > 1 ? window.setInterval(() => setIndex((i) => (i + 1) % count), 6000) : 0;
    return () => {
      window.removeEventListener("keydown", onKey);
      if (id) window.clearInterval(id);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [count, onClose]);

  const current = items[index];
  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      <button
        onClick={onClose}
        className="absolute right-6 top-6 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Exit slideshow"
      >
        <X className="h-5 w-5" />
      </button>
      {count === 0 ? (
        <p className="text-white/60">No photos yet.</p>
      ) : current?.url ? (
        <img src={current.url} alt="" className="max-h-full max-w-full object-contain" />
      ) : null}
      {items.length > 1 && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-1.5">
          {items.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/30"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

