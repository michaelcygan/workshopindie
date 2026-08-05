import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImageIcon, Loader2, Lock, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listEventWall, postToEventWall, deleteWallItem, type WallItem } from "@/lib/events/wall.functions";
import { recordEventPhoto } from "@/lib/event-photos.functions";
import { resizeImageToJpeg } from "@/lib/image-resize";
import { ProfilePeek } from "@/components/profile-peek";

type Props = {
  eventId: string;
  /** "wall" = the full chronological stream. "gallery" = the photos in it. */
  view?: "wall" | "gallery";
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * One stream for everything that happened at the Event. The Gallery tab
 * renders the same data with `view="gallery"` — there is no second feed.
 */
export function EventWallFeed({ eventId, view = "wall" }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listEventWall);
  const key = ["event-wall", eventId, user?.id ?? null];

  const { data, isLoading } = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: () => listFn({ data: { event_id: eventId } }),
    staleTime: 15_000,
    refetchInterval: 45_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["event-wall", eventId] });

  if (!user) {
    return (
      <LockedNote>
        <>Sign in and RSVP to see the Wall.</>
      </LockedNote>
    );
  }
  if (isLoading) {
    return <div className="py-10 text-center text-sm text-ink-muted">Loading…</div>;
  }
  if (!data?.can_view) {
    return (
      <LockedNote>
        <>RSVP to open the Wall — posts and photos live here.</>
      </LockedNote>
    );
  }

  const photos = data.items.filter((i) => i.kind === "photo");
  const items = view === "gallery" ? photos : data.items;

  return (
    <div className="space-y-5">
      {view === "wall" && (
        <WallComposer
          eventId={eventId}
          canPost={data.can_post}
          closesAt={data.closes_at}
          onPosted={refresh}
        />
      )}
      {view === "gallery" && data.can_post && (
        <div className="flex justify-end">
          <PhotoButton eventId={eventId} onUploaded={refresh} label="Add photos" />
        </div>
      )}

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-background p-8 text-center text-sm text-ink-muted">
          {view === "gallery" ? "No photos yet." : "Nothing here yet. Say the first thing."}
        </p>
      ) : view === "gallery" ? (
        <PhotoGrid items={items} onDeleted={refresh} />
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <WallRow key={`${item.kind}-${item.id}`} item={item} onDeleted={refresh} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LockedNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-background p-8 text-center">
      <Lock className="mx-auto mb-2 h-4 w-4 text-ink-muted" />
      <p className="text-sm text-ink-soft">{children}</p>
    </div>
  );
}

function WallRow({ item, onDeleted }: { item: WallItem; onDeleted: () => void }) {
  const delFn = useServerFn(deleteWallItem);
  const del = useMutation({
    mutationFn: () => delFn({ data: { id: item.id, kind: item.kind } }),
    onSuccess: () => {
      toast.success("Removed");
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const name = item.author?.display_name ?? item.author?.username ?? "Someone";

  return (
    <li className="flex gap-3">
      {item.author ? (
        <ProfilePeek userId={item.author.user_id}>
          <button type="button" className="shrink-0">
            <Avatar className="h-8 w-8">
              <AvatarImage src={item.author.avatar_url ?? undefined} />
              <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
            </Avatar>
          </button>
        </ProfilePeek>
      ) : (
        <Avatar className="h-8 w-8 shrink-0"><AvatarFallback>?</AvatarFallback></Avatar>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span className="font-medium text-ink">{name}</span>
          <span>{timeAgo(item.created_at)}</span>
          {item.can_delete && (
            <button
              type="button"
              onClick={() => del.mutate()}
              disabled={del.isPending}
              className="ml-auto text-ink-muted hover:text-destructive"
              aria-label="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {item.body && <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{item.body}</p>}
        {item.kind === "photo" && (
          <div className="mt-2 overflow-hidden rounded-xl border border-border bg-muted">
            {item.image_url ? (
              <img src={item.image_url} alt="" loading="lazy" className="max-h-[420px] w-full object-cover" />
            ) : (
              <div className="flex h-40 items-center justify-center text-ink-muted"><Camera className="h-5 w-5" /></div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function PhotoGrid({ items, onDeleted }: { items: WallItem[]; onDeleted: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const delFn = useServerFn(deleteWallItem);
  const current = open !== null ? items[open] : null;

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {items.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setOpen(i)}
            className="group relative aspect-square overflow-hidden rounded-xl bg-muted"
          >
            {p.image_url ? (
              <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-ink-muted"><Camera className="h-5 w-5" /></div>
            )}
          </button>
        ))}
      </div>
      {current && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4" onClick={() => setOpen(null)}>
          <button
            onClick={() => setOpen(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div onClick={(e) => e.stopPropagation()} className="max-w-full">
            {current.image_url && (
              <img src={current.image_url} alt="" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain" />
            )}
            <div className="mt-3 flex items-center justify-between text-xs text-white/70">
              <span>
                {current.author?.display_name ?? current.author?.username ?? "Someone"} · {timeAgo(current.created_at)}
              </span>
              {current.can_delete && (
                <button
                  onClick={async () => {
                    await delFn({ data: { id: current.id, kind: "photo" } });
                    setOpen(null);
                    onDeleted();
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-white hover:bg-red-500/80"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function WallComposer({
  eventId,
  canPost,
  closesAt,
  onPosted,
}: {
  eventId: string;
  canPost: boolean;
  closesAt: string | null;
  onPosted: () => void;
}) {
  const [body, setBody] = useState("");
  const postFn = useServerFn(postToEventWall);
  const post = useMutation({
    mutationFn: () => postFn({ data: { event_id: eventId, body: body.trim() } }),
    onSuccess: () => {
      setBody("");
      onPosted();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canPost) {
    return (
      <p className="rounded-xl border border-border bg-muted/40 p-3 text-center text-xs text-ink-muted">
        Posting is closed. The Wall stays here as the record of the night.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Say something to the room…"
        maxLength={500}
        rows={2}
        className="resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <PhotoButton eventId={eventId} onUploaded={onPosted} label="Photo" variant="ghost" />
        <div className="flex items-center gap-2">
          {closesAt && (
            <span className="hidden text-[11px] text-ink-muted sm:inline">
              Open until {new Date(closesAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" })}
            </span>
          )}
          <Button
            size="sm"
            className="rounded-md gap-1.5"
            disabled={!body.trim() || post.isPending}
            onClick={() => post.mutate()}
          >
            {post.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}

function PhotoButton({
  eventId,
  onUploaded,
  label,
  variant = "outline",
}: {
  eventId: string;
  onUploaded: () => void;
  label: string;
  variant?: "outline" | "ghost";
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recordFn = useServerFn(recordEventPhoto);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 12);
    setBusy(true);
    let failed = 0;
    for (const file of list) {
      try {
        if (!file.type.startsWith("image/")) throw new Error("not an image");
        const { blob, width, height, mime } = await resizeImageToJpeg(file, 1500, 0.82);
        const path = `${eventId}/${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage
          .from("event-photos")
          .upload(path, blob, { contentType: mime, cacheControl: "3600", upsert: false });
        if (up.error) throw up.error;
        await recordFn({ data: { event_id: eventId, storage_path: path, width: width || null, height: height || null } });
      } catch {
        failed++;
      }
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (failed === list.length) toast.error("Upload failed");
    else onUploaded();
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      <Button
        type="button"
        size="sm"
        variant={variant}
        className="rounded-md gap-1.5"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
        {label}
      </Button>
    </>
  );
}
