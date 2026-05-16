import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Tldraw,
  type Editor,
  type TLAssetStore,
  type TLStoreSnapshot,
  type HistoryEntry,
  type TLRecord,
  getSnapshot,
  loadSnapshot,
} from "tldraw";
import "tldraw/tldraw.css";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Ephemeral collaborative whiteboard for an Instant Workshop.
 *
 * Sync model (scales past full-snapshot broadcast):
 * - Local user edits → broadcast a small RecordsDiff over Supabase Realtime
 *   on `whiteboard:{roomId}` (debounced 80ms). Diffs stay well under the
 *   256KB Realtime payload cap regardless of canvas size.
 * - Remote diffs → applied via `store.mergeRemoteChanges(...)` so the local
 *   listener doesn't echo them back.
 * - Late-joiners broadcast `request-state`; any peer responds with a one-shot
 *   full snapshot. After that initial sync, only diffs flow.
 *
 * Assets:
 * - Image uploads go to the public `instant-whiteboard` bucket under
 *   `{roomId}/{uuid}.{ext}` and are tracked in `instant_whiteboard_assets`.
 * - Tracking insert is awaited; on failure the storage object is deleted so
 *   we never leave orphans the purge job can't see.
 *
 * Cleanup:
 * - DB trigger archives the room and deletes asset rows when the last
 *   presence row leaves (see migration). This component only does best-effort
 *   client-side purge; the trigger is the source of truth.
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
  const pendingDiffRef = useRef<HistoryEntry<TLRecord>["changes"] | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const subscribedRef = useRef(false);
  const [ready, setReady] = useState(false);

  const assetStore = useMemo<TLAssetStore>(() => ({
    async upload(_asset, file) {
      const rawExt = (file.name.split(".").pop() || "png").toLowerCase();
      const ext = rawExt.replace(/[^a-z0-9]/g, "") || "png";
      const path = `${roomId}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("instant-whiteboard")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        toast.error(`Upload failed: ${upErr.message}`);
        throw upErr;
      }

      // Track for purge — if this fails, roll back the storage object so we
      // never leave an orphan invisible to cleanup.
      const { error: trackErr } = await supabase
        .from("instant_whiteboard_assets")
        .insert({ room_id: roomId, user_id: userId, storage_path: path });
      if (trackErr) {
        await supabase.storage.from("instant-whiteboard").remove([path]).catch(() => {});
        toast.error(`Upload tracking failed: ${trackErr.message}`);
        throw trackErr;
      }

      const { data } = supabase.storage.from("instant-whiteboard").getPublicUrl(path);
      return { src: data.publicUrl };
    },
    resolve(asset) {
      return asset.props.src ?? null;
    },
  }), [roomId, userId]);

  // Merge a pending diff and broadcast it. Debounced so a stroke doesn't
  // produce dozens of micro-broadcasts.
  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null;
      const channel = channelRef.current;
      const diff = pendingDiffRef.current;
      pendingDiffRef.current = null;
      if (!channel || !diff) return;
      channel.send({
        type: "broadcast",
        event: "diff",
        payload: { from: userId, diff },
      });
    }, 80);
  }, [userId]);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Local user edits → queue diff for broadcast.
    const unlisten = editor.store.listen(
      (entry: HistoryEntry<TLRecord>) => {
        if (applyingRemoteRef.current) return;
        const incoming = entry.changes;
        // Merge into pending so we coalesce bursts within the debounce window.
        const prev = pendingDiffRef.current;
        if (!prev) {
          pendingDiffRef.current = {
            added: { ...incoming.added },
            updated: { ...incoming.updated },
            removed: { ...incoming.removed },
          };
        } else {
          Object.assign(prev.added, incoming.added);
          Object.assign(prev.updated, incoming.updated);
          Object.assign(prev.removed, incoming.removed);
        }
        scheduleFlush();
      },
      { source: "user", scope: "document" },
    );

    setReady(true);
    return () => { unlisten(); };
  }, [scheduleFlush]);

  // Apply a remote diff under mergeRemoteChanges so we don't echo back.
  const applyRemoteDiff = useCallback((diff: HistoryEntry<TLRecord>["changes"]) => {
    const editor = editorRef.current;
    if (!editor) return;
    applyingRemoteRef.current = true;
    try {
      editor.store.mergeRemoteChanges(() => {
        const toPut: TLRecord[] = [
          ...Object.values(diff.added ?? {}),
          // updated is { id: [from, to] } — apply the "to" side
          ...Object.values(diff.updated ?? {}).map((pair) => (pair as [TLRecord, TLRecord])[1]),
        ];
        if (toPut.length > 0) editor.store.put(toPut);
        const toRemove = Object.keys(diff.removed ?? {}) as TLRecord["id"][];
        if (toRemove.length > 0) editor.store.remove(toRemove);
      });
    } catch (e) {
      console.error("whiteboard diff merge failed", e);
    } finally {
      // Defer reset so listener doesn't re-broadcast.
      setTimeout(() => { applyingRemoteRef.current = false; }, 0);
    }
  }, []);

  const applyRemoteSnapshot = useCallback((snapshot: TLStoreSnapshot) => {
    const editor = editorRef.current;
    if (!editor) return;
    applyingRemoteRef.current = true;
    try {
      loadSnapshot(editor.store, snapshot);
    } catch (e) {
      console.error("whiteboard snapshot load failed", e);
    } finally {
      setTimeout(() => { applyingRemoteRef.current = false; }, 0);
    }
  }, []);

  // Wire realtime channel.
  useEffect(() => {
    const channel = supabase.channel(`whiteboard:${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "diff" }, (msg) => {
      const payload = msg.payload as { from: string; diff: HistoryEntry<TLRecord>["changes"] };
      if (!payload?.diff || payload.from === userId) return;
      applyRemoteDiff(payload.diff);
    });

    // First-time snapshot for late joiners only.
    channel.on("broadcast", { event: "snapshot" }, (msg) => {
      const editor = editorRef.current;
      if (!editor) return;
      const payload = msg.payload as { from: string; snapshot: TLStoreSnapshot };
      if (!payload?.snapshot || payload.from === userId) return;
      // Only adopt a remote snapshot if our store is essentially empty —
      // otherwise we'd clobber the user's in-flight work.
      const localShapes = editor.getCurrentPageShapeIds().size;
      if (localShapes === 0) applyRemoteSnapshot(payload.snapshot);
    });

    channel.on("broadcast", { event: "request-state" }, () => {
      const editor = editorRef.current;
      if (!editor) return;
      const snapshot = getSnapshot(editor.store);
      channel.send({ type: "broadcast", event: "snapshot", payload: { from: userId, snapshot } });
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" && !subscribedRef.current) {
        subscribedRef.current = true;
        // Ask peers for the current canvas state once on join.
        channel.send({ type: "broadcast", event: "request-state", payload: { from: userId } });
      }
    });

    return () => {
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
      subscribedRef.current = false;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, userId, applyRemoteDiff, applyRemoteSnapshot]);

  const handleExport = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const shapeIds = editor.getCurrentPageShapeIds();
      if (shapeIds.size === 0) {
        toast.info("Whiteboard is empty");
        return;
      }
      const result = await editor.toImage([...shapeIds], { format: "png", background: true });
      if (!result?.blob) return;
      const url = URL.createObjectURL(result.blob);
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
        <Tldraw onMount={handleMount} assets={assetStore} />
      </div>
    </div>
  );
}
