import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tldraw, type Editor, type TLAssetStore, type TLStoreSnapshot, getSnapshot, loadSnapshot, uniqueId } from "tldraw";
import "tldraw/tldraw.css";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Ephemeral collaborative whiteboard for an Instant Workshop.
 *
 * - State is synced via Supabase Realtime broadcast on `whiteboard:{roomId}`.
 *   Snapshots are debounced & broadcast on local change; remote snapshots are
 *   loaded into the store under `mergeRemoteChanges`-style guards so we don't
 *   echo our own deltas back.
 * - Image uploads (drag/drop, paste, "Add image" tool) go to the public
 *   `instant-whiteboard` bucket under `{roomId}/{uuid}.{ext}` and are tracked
 *   in `instant_whiteboard_assets` so they can be purged when the room ends.
 * - No DB persistence of shapes — pure realtime, dies with the channel.
 */
export default function RoomWhiteboard({
  roomId,
  userId,
  className,
}: {
  roomId: string;
  userId: string;
  className?: string;
}) {
  const editorRef = useRef<Editor | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const applyingRemoteRef = useRef(false);
  const broadcastTimerRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  // Asset store: upload images to Supabase storage and return a public URL.
  const assetStore = useMemo<TLAssetStore>(() => ({
    async upload(_asset, file) {
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${roomId}/${uniqueId()}.${ext || "png"}`;
      const { error: upErr } = await supabase.storage
        .from("instant-whiteboard")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        toast.error(`Upload failed: ${upErr.message}`);
        throw upErr;
      }
      // Track for purge
      await supabase.from("instant_whiteboard_assets").insert({
        room_id: roomId, user_id: userId, storage_path: path,
      });
      const { data } = supabase.storage.from("instant-whiteboard").getPublicUrl(path);
      return { src: data.publicUrl };
    },
    resolve(asset) {
      return asset.props.src ?? null;
    },
  }), [roomId, userId]);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Subscribe to local changes → debounced broadcast.
    const unlisten = editor.store.listen(
      () => {
        if (applyingRemoteRef.current) return;
        if (broadcastTimerRef.current) window.clearTimeout(broadcastTimerRef.current);
        broadcastTimerRef.current = window.setTimeout(() => {
          const channel = channelRef.current;
          if (!channel) return;
          const snapshot = getSnapshot(editor.store);
          channel.send({
            type: "broadcast",
            event: "snapshot",
            payload: { from: userId, snapshot },
          });
        }, 150);
      },
      { source: "user", scope: "document" },
    );

    setReady(true);
    return () => { unlisten(); };
  }, [userId]);

  // Wire realtime channel.
  useEffect(() => {
    const channel = supabase.channel(`whiteboard:${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "snapshot" }, (msg) => {
      const editor = editorRef.current;
      if (!editor) return;
      const payload = msg.payload as { from: string; snapshot: TLStoreSnapshot };
      if (!payload?.snapshot || payload.from === userId) return;
      applyingRemoteRef.current = true;
      try {
        loadSnapshot(editor.store, payload.snapshot);
      } catch (e) {
        console.error("whiteboard merge failed", e);
      } finally {
        // Defer reset so listener doesn't re-broadcast.
        setTimeout(() => { applyingRemoteRef.current = false; }, 0);
      }
    });

    // When someone newly joins, they ping for the current snapshot.
    channel.on("broadcast", { event: "request-state" }, () => {
      const editor = editorRef.current;
      if (!editor) return;
      const snapshot = getSnapshot(editor.store);
      channel.send({ type: "broadcast", event: "snapshot", payload: { from: userId, snapshot } });
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Ask peers for the current canvas state.
        channel.send({ type: "broadcast", event: "request-state", payload: { from: userId } });
      }
    });

    return () => {
      if (broadcastTimerRef.current) window.clearTimeout(broadcastTimerRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, userId]);

  const handleExport = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const shapeIds = editor.getCurrentPageShapeIds();
      if (shapeIds.size === 0) {
        toast.info("Whiteboard is empty");
        return;
      }
      const { blob } = await editor.toImage([...shapeIds], { format: "png", background: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `whiteboard-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't export");
    }
  }, []);

  return (
    <div className={cn("relative flex flex-col rounded-2xl border border-border bg-surface overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
          Whiteboard · ephemeral
        </div>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleExport}>
          <Download className="h-3 w-3" /> Save PNG
        </Button>
      </div>
      <div className="relative flex-1 min-h-0">
        {!ready && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        <Tldraw
          onMount={handleMount}
          assets={assetStore}
          persistenceKey={undefined}
          inferDarkMode
        />
      </div>
    </div>
  );
}
