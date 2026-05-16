import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, StickyNote, Link2, Type, X, Upload, Loader2, ExternalLink, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const CANVAS_W = 4000;
const CANVAS_H = 3000;

/**
 * Ephemeral pinboard for any Instant/Workshop room. Items (image, sticky note,
 * link button, text label) live in `instant_board_items` and are wiped when
 * the room empties (DB trigger). Realtime sync via postgres_changes.
 */

type Kind = "image" | "sticky" | "link" | "text";
type Content =
  | { src: string; alt?: string }
  | { text: string; color: string }
  | { url: string; label: string }
  | { text: string };
type Item = {
  id: string;
  room_id: string;
  user_id: string;
  kind: Kind;
  content: Content;
  x: number; y: number; w: number; h: number; z: number;
};

const STICKY_COLORS = [
  { name: "yellow", bg: "#fef3c7", ink: "#78350f" },
  { name: "pink",   bg: "#fce7f3", ink: "#831843" },
  { name: "blue",   bg: "#dbeafe", ink: "#1e3a8a" },
  { name: "green",  bg: "#d1fae5", ink: "#064e3b" },
  { name: "lav",    bg: "#ede9fe", ink: "#4c1d95" },
  { name: "peach",  bg: "#ffedd5", ink: "#7c2d12" },
];

function stickyPalette(name: string) {
  return STICKY_COLORS.find((c) => c.name === name) ?? STICKY_COLORS[0];
}

export default function RoomBoard({ roomId, userId, className, onEnterFullscreen }: { roomId: string; userId: string; className?: string; onEnterFullscreen?: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; itemX: number; itemY: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Initial load + realtime
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("instant_board_items")
        .select("*")
        .eq("room_id", roomId)
        .order("z", { ascending: true });
      if (cancelled) return;
      if (error) toast.error(error.message);
      else setItems((data ?? []) as unknown as Item[]);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`board:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "instant_board_items", filter: `room_id=eq.${roomId}` },
        (p) => setItems((prev) => prev.some((x) => x.id === (p.new as Item).id) ? prev : [...prev, p.new as Item]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "instant_board_items", filter: `room_id=eq.${roomId}` },
        (p) => setItems((prev) => prev.map((x) => x.id === (p.new as Item).id ? (p.new as Item) : x)))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "instant_board_items", filter: `room_id=eq.${roomId}` },
        (p) => setItems((prev) => prev.filter((x) => x.id !== (p.old as Item).id)))
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [roomId]);

  const maxZ = useMemo(() => items.reduce((m, x) => Math.max(m, x.z), 0), [items]);

  const addItem = useCallback(async (kind: Kind, content: Content, size?: { w: number; h: number }) => {
    const w = size?.w ?? (kind === "text" ? 240 : kind === "link" ? 220 : kind === "image" ? 240 : 200);
    const h = size?.h ?? (kind === "text" ? 60 : kind === "link" ? 56 : kind === "image" ? 180 : 200);
    // Drop near the center of the visible viewport (in canvas coords).
    const sc = scrollRef.current;
    const z = zoomRef.current;
    const viewCx = sc ? (sc.scrollLeft + sc.clientWidth / 2) / z : CANVAS_W / 2;
    const viewCy = sc ? (sc.scrollTop + sc.clientHeight / 2) / z : CANVAS_H / 2;
    const jitter = () => (Math.random() - 0.5) * 80;
    const x = Math.max(20, Math.min(CANVAS_W - w - 20, viewCx - w / 2 + jitter()));
    const y = Math.max(20, Math.min(CANVAS_H - h - 20, viewCy - h / 2 + jitter()));
    const row = { room_id: roomId, user_id: userId, kind, content, x, y, w, h, z: maxZ + 1 };
    const { data, error } = await supabase.from("instant_board_items").insert(row).select().single();
    if (error) { toast.error(error.message); return; }
    setItems((prev) => prev.some((x) => x.id === data.id) ? prev : [...prev, data as unknown as Item]);
  }, [roomId, userId, maxZ]);

  const updateItem = useCallback(async (id: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((x) => x.id === id ? { ...x, ...patch } as Item : x));
    const { error } = await supabase.from("instant_board_items").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    const { error } = await supabase.from("instant_board_items").delete().eq("id", id);
    if (error) toast.error(error.message);
  }, []);

  // Drag handlers — divide screen-space deltas by zoom to keep the cursor on the item.
  const onPointerDown = (e: React.PointerEvent, item: Item) => {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id: item.id, startX: e.clientX, startY: e.clientY, itemX: item.x, itemY: item.y };
    setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, z: maxZ + 1 } : x));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const z = zoomRef.current;
    const dx = (e.clientX - d.startX) / z;
    const dy = (e.clientY - d.startY) / z;
    setItems((prev) => prev.map((x) => x.id === d.id ? { ...x, x: d.itemX + dx, y: d.itemY + dy } : x));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const it = items.find((x) => x.id === d.id);
    if (!it) return;
    void updateItem(d.id, { x: it.x, y: it.y, z: maxZ + 1 });
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Zoom — keep the viewport center anchored when scale changes.
  const applyZoom = useCallback((next: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(next * 100) / 100));
    const sc = scrollRef.current;
    if (sc) {
      const cx = (sc.scrollLeft + sc.clientWidth / 2) / zoomRef.current;
      const cy = (sc.scrollTop + sc.clientHeight / 2) / zoomRef.current;
      zoomRef.current = clamped;
      setZoom(clamped);
      requestAnimationFrame(() => {
        sc.scrollLeft = Math.max(0, cx * clamped - sc.clientWidth / 2);
        sc.scrollTop = Math.max(0, cy * clamped - sc.clientHeight / 2);
      });
    } else {
      zoomRef.current = clamped;
      setZoom(clamped);
    }
  }, []);

  return (
    <div className={cn("relative flex flex-col rounded-2xl border border-border bg-surface overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">Board · ephemeral</div>
          {onEnterFullscreen && (
            <button
              type="button"
              onClick={onEnterFullscreen}
              className="rounded-full p-1 text-ink-muted hover:bg-muted hover:text-ink"
              aria-label="Enter fullscreen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Toolbar onAdd={addItem} roomId={roomId} userId={userId} />
      </div>

      <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-auto bg-muted/20">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <p className="text-sm text-ink-muted">Drop an image, sticky, link, or text to start.</p>
          </div>
        )}
        <div
          ref={canvasRef}
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `scale(${zoom})`,
            transformOrigin: "0 0",
          }}
          className="relative"
        >
          {items.map((it) => {
            const canEdit = it.user_id === userId;
            return (
              <div
                key={it.id}
                onPointerDown={(e) => onPointerDown(e, it)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{ left: it.x, top: it.y, width: it.w, minHeight: it.h, zIndex: it.z }}
                className="absolute touch-none select-none cursor-grab active:cursor-grabbing group"
              >
                <ItemView
                  item={it}
                  editing={editingId === it.id}
                  canEdit={canEdit}
                  onStartEdit={() => canEdit && setEditingId(it.id)}
                  onStopEdit={() => setEditingId(null)}
                  onChange={(patch) => updateItem(it.id, patch)}
                  onDelete={() => deleteItem(it.id)}
                />
              </div>
            );
          })}
        </div>

        {/* Zoom controls — floating, sticky to the viewport */}
        <div className="pointer-events-none sticky bottom-3 z-20 flex justify-end pr-3" style={{ top: "calc(100% - 2.75rem)" }}>
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-background/95 px-2 py-1.5 shadow-soft backdrop-blur">
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => applyZoom(zoom - 0.1)} aria-label="Zoom out">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Slider
              value={[zoom]}
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.05}
              onValueChange={(v) => applyZoom(v[0] ?? 1)}
              className="w-32"
            />
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => applyZoom(zoom + 0.1)} aria-label="Zoom in">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <button
              type="button"
              onClick={() => applyZoom(1)}
              className="w-12 text-center text-[10px] tabular-nums text-ink-muted hover:text-ink"
              aria-label="Reset zoom to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Toolbar ---------------- */

function Toolbar({ onAdd, roomId, userId }: { onAdd: (k: Kind, c: Content, s?: { w: number; h: number }) => void; roomId: string; userId: string }) {
  return (
    <div className="flex items-center gap-1">
      <ImageAdd onAdd={onAdd} roomId={roomId} userId={userId} />
      <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => onAdd("sticky", { text: "", color: "yellow" })}>
        <StickyNote className="h-3.5 w-3.5" /> Sticky
      </Button>
      <LinkAdd onAdd={onAdd} />
      <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => onAdd("text", { text: "Text" })}>
        <Type className="h-3.5 w-3.5" /> Text
      </Button>
    </div>
  );
}

function ImageAdd({ onAdd, roomId, userId }: { onAdd: (k: Kind, c: Content) => void; roomId: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.size > 8 * 1024 * 1024) { toast.error("Max 8MB"); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const path = `${roomId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("instant-whiteboard").upload(path, file, { contentType: file.type });
      if (error) throw error;
      await supabase.from("instant_whiteboard_assets").insert({ room_id: roomId, user_id: userId, storage_path: path });
      const { data } = supabase.storage.from("instant-whiteboard").getPublicUrl(path);
      onAdd("image", { src: data.publicUrl });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 text-xs">
          <ImageIcon className="h-3.5 w-3.5" /> Image
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <Tabs defaultValue="url">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url">URL</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>
          <TabsContent value="url" className="space-y-2 pt-2">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            <Button
              size="sm"
              className="w-full"
              disabled={!url.trim()}
              onClick={() => { onAdd("image", { src: url.trim() }); setUrl(""); setOpen(false); }}
            >
              Add image
            </Button>
          </TabsContent>
          <TabsContent value="upload" className="pt-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
            />
            <Button size="sm" className="w-full gap-1.5" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? "Uploading…" : "Choose file"}
            </Button>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

function LinkAdd({ onAdd }: { onAdd: (k: Kind, c: Content) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 text-xs">
          <Link2 className="h-3.5 w-3.5" /> Link
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2" align="end">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Button label" />
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        <Button
          size="sm"
          className="w-full"
          disabled={!url.trim() || !label.trim()}
          onClick={() => {
            let u = url.trim();
            if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
            onAdd("link", { url: u, label: label.trim() });
            setUrl(""); setLabel(""); setOpen(false);
          }}
        >
          Add link
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/* ---------------- Item view ---------------- */

function ItemView({
  item, editing, canEdit, onStartEdit, onStopEdit, onChange, onDelete,
}: {
  item: Item; editing: boolean; canEdit: boolean;
  onStartEdit: () => void; onStopEdit: () => void;
  onChange: (patch: Partial<Item>) => void; onDelete: () => void;
}) {
  const deleteBtn = canEdit && (
    <button
      data-no-drag
      onClick={onDelete}
      className="absolute -right-2 -top-2 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-ink-muted shadow-soft hover:text-ink group-hover:flex"
      aria-label="Delete"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );

  if (item.kind === "image") {
    const c = item.content as { src: string; alt?: string };
    return (
      <div className="relative h-full w-full overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        {deleteBtn}
        <img src={c.src} alt={c.alt ?? ""} className="h-full w-full object-cover pointer-events-none" draggable={false} />
      </div>
    );
  }

  if (item.kind === "sticky") {
    const c = item.content as { text: string; color: string };
    const p = stickyPalette(c.color);
    return (
      <div
        className="relative h-full w-full rounded-md shadow-soft p-3"
        style={{ background: p.bg, color: p.ink }}
        onDoubleClick={onStartEdit}
      >
        {deleteBtn}
        {canEdit && (
          <div data-no-drag className="absolute -top-2 left-2 hidden gap-1 group-hover:flex">
            {STICKY_COLORS.map((sc) => (
              <button
                key={sc.name}
                onClick={() => onChange({ content: { ...c, color: sc.name } })}
                className={cn("h-3 w-3 rounded-full border border-black/10", c.color === sc.name && "ring-2 ring-ink ring-offset-1")}
                style={{ background: sc.bg }}
                aria-label={sc.name}
              />
            ))}
          </div>
        )}
        {editing ? (
          <Textarea
            data-no-drag
            autoFocus
            value={c.text}
            onChange={(e) => onChange({ content: { ...c, text: e.target.value } })}
            onBlur={onStopEdit}
            className="h-full w-full resize-none bg-transparent border-0 p-0 text-sm focus-visible:ring-0"
            style={{ color: p.ink }}
            placeholder="Type a note…"
          />
        ) : (
          <div className="whitespace-pre-wrap break-words text-sm min-h-[1.25rem]">
            {c.text || (canEdit ? <span className="opacity-50">Double-click to edit</span> : "")}
          </div>
        )}
      </div>
    );
  }

  if (item.kind === "link") {
    const c = item.content as { url: string; label: string };
    return (
      <div className="relative h-full w-full">
        {deleteBtn}
        <a
          data-no-drag
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-full w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-90"
        >
          <ExternalLink className="h-4 w-4" />
          <span className="truncate">{c.label}</span>
        </a>
        {canEdit && !editing && (
          <button
            data-no-drag
            onClick={onStartEdit}
            className="absolute -left-2 -top-2 hidden h-6 rounded-full border border-border bg-background px-2 text-[10px] text-ink-muted shadow-soft hover:text-ink group-hover:flex items-center"
          >
            Edit
          </button>
        )}
        {editing && (
          <div data-no-drag className="absolute left-0 top-full z-20 mt-1 w-full space-y-1 rounded-md border border-border bg-surface p-2 shadow-soft">
            <Input value={c.label} onChange={(e) => onChange({ content: { ...c, label: e.target.value } })} placeholder="Label" />
            <Input value={c.url} onChange={(e) => onChange({ content: { ...c, url: e.target.value } })} placeholder="URL" />
            <Button size="sm" className="w-full" onClick={onStopEdit}>Done</Button>
          </div>
        )}
      </div>
    );
  }

  // text
  const c = item.content as { text: string };
  return (
    <div className="relative h-full w-full" onDoubleClick={onStartEdit}>
      {deleteBtn}
      {editing ? (
        <Textarea
          data-no-drag
          autoFocus
          value={c.text}
          onChange={(e) => onChange({ content: { text: e.target.value } })}
          onBlur={onStopEdit}
          className="h-full w-full resize-none border-0 bg-transparent p-1 text-lg font-medium text-ink focus-visible:ring-0"
          placeholder="Text…"
        />
      ) : (
        <div className="whitespace-pre-wrap break-words p-1 text-lg font-medium text-ink">
          {c.text || (canEdit ? <span className="opacity-40">Double-click to edit</span> : "")}
        </div>
      )}
    </div>
  );
}
