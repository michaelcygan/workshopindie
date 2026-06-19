import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Pin, ListChecks, FileText, Github, Trash2, Plus, ExternalLink, Check,
  FolderOpen, MonitorPlay, PenLine, Mic, X, ListMusic, PictureInPicture2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import type { Category } from "@/lib/categories";
import { WorkshopDocsEditor, type DocsScope } from "@/components/workshop-docs-editor";
import { WorkshopDrivePanel, type DrivePanelScope } from "@/components/workshop-drive-panel";
import { WorkshopScreenSharePanel } from "@/components/workshop-screen-share-panel";
import RoomBoard from "@/components/room-board";
import { WorkshopPlayerTool } from "@/components/workshop-player-tool";
import { WorkshopRecordingLink } from "@/components/workshop-recording-link";

// Shipped tools (enable-able today). `outline` is the stored value behind the "Docs" label.
// Moodboard was retired in favor of Board (a whiteboard that already supports image/text/link stickers).
type ShippedToolType = "pinboard" | "list" | "outline" | "drive" | "repo_links" | "screen_share" | "recorder" | "board" | "player" | "pip";
// Tools on the roadmap, surfaced as disabled "Coming soon" chips so users know they're planned.
type ComingSoonToolType = never;
type ToolType = ShippedToolType | ComingSoonToolType;


type Preset = {
  label: string;
  icon: typeof Pin;
  blurb: string;
  comingSoon?: boolean;
  titlePlaceholder?: string;
  bodyPlaceholder?: string;
  urlPlaceholder?: string;
  fields: ("title" | "body" | "url")[];
};

// Order here drives chip order in the picker. Screen Share first, Recording second, then
// collaboration surfaces, then niche ones. Pinboard is intentionally absent from
// TOOL_ORDER — its function is fully covered by Board (whiteboard with image/text/link
// stickers). The PRESETS entry stays so legacy Pinboard rows still render via presetFor().
const PRESETS: Record<ToolType, Preset> = {
  screen_share: { label: "Screen Share", icon: MonitorPlay, blurb: "Share your screen with everyone in the room.", fields: [] },
  recorder:     { label: "Recording",    icon: Mic,         blurb: "Drop in your Zoom, Riverside, or SquadCast link — everyone joins from here.", fields: [] },
  pip:          { label: "Pop-out",      icon: PictureInPicture2, blurb: "Float the room in a Picture-in-Picture window so you can keep working in other tabs.", fields: [] },
  outline:      { label: "Docs",         icon: FileText,    blurb: "Collaborative notes, drafts, scripts.", fields: [] },
  board:        { label: "Board",        icon: PenLine,     blurb: "Shared whiteboard for images, text, links, and reference pins.", fields: [] },
  list:         { label: "List",         icon: ListChecks,  blurb: "To-dos, shots, tracks — any list.", titlePlaceholder: "What's on the list?", urlPlaceholder: "Optional link",          fields: ["title", "body", "url"] },
  drive:        { label: "Drive",        icon: FolderOpen,  blurb: "Share cloud links and recordings.", fields: [] },
  player:       { label: "Player",       icon: ListMusic,   blurb: "Stream a shared queue — YouTube, SoundCloud, Spotify…", fields: [] },
  repo_links:   { label: "Repo & Demo",  icon: Github,      blurb: "Code repos and live demos.",     titlePlaceholder: "Label",             urlPlaceholder: "Repo, demo, or doc URL", fields: ["title", "url"] },
  pinboard:     { label: "Pinboard",     icon: Pin,         blurb: "References, ideas, links.",      bodyPlaceholder: "Drop a reference, idea, or link…",  fields: ["body", "url"] },
};

// Picker is now grouped into Realtime + Objects strips. Docs (outline), Pinboard,
// and Repo & Demo are intentionally removed from the picker for v1 launch — folded
// into Drive as link kinds (Google Doc / GitHub Repo). Legacy enabled rows still
// render via presetFor() so nothing disappears for existing rooms.
const TOOL_REALTIME: ToolType[] = ["screen_share", "pip"];
const TOOL_OBJECTS: ToolType[] = ["drive", "board", "list", "player", "recorder"];
const TOOL_ORDER: ToolType[] = [...TOOL_REALTIME, ...TOOL_OBJECTS];


const CATEGORY_DEFAULTS: Record<Category, ShippedToolType> = {
  film: "list", music: "list", writing: "outline", build: "repo_links", visual: "board",
  critique: "outline", business: "outline", coworking: "outline",
  office_hours: "outline", roundtable: "outline", pitch: "outline",
  listen_party: "list", open_mic: "list", jam: "outline", standup: "outline",
};

// Stored value mapping — UI label "List" stores tool_type='list'.
// Legacy rows with tool_type='shot_list' / 'track_list' are still rendered as List below.
// Legacy 'moodboard' rows were migrated to 'board' by SQL; map any stragglers defensively.
type StoredToolType = ShippedToolType | "shot_list" | "track_list" | "moodboard";

function presetFor(stored: StoredToolType): Preset {
  if (stored === "shot_list" || stored === "track_list") return PRESETS.list;
  if (stored === "moodboard") return PRESETS.board;
  return PRESETS[stored];
}

export type ToolsScope =
  | { kind: "persistent"; workshopId: string; hostUserId: string; category: Category }
  | { kind: "instant"; roomId: string; hostUserId: string | null; category?: Category | null };

function tables(scope: ToolsScope) {
  if (scope.kind === "persistent") {
    return {
      toolsTable: "workshop_tools" as const,
      itemsTable: "workshop_tool_items" as const,
      parentCol: "workshop_id" as const,
      parentId: scope.workshopId,
      profileFk: "workshop_tool_items_created_by_user_id_fkey" as const,
    };
  }
  return {
    toolsTable: "instant_tools" as const,
    itemsTable: "instant_tool_items" as const,
    parentCol: "room_id" as const,
    parentId: scope.roomId,
    profileFk: "instant_tool_items_created_by_user_id_fkey" as const,
  };
}

type LegacyProps = { workshopId: string; hostUserId: string; category: Category };
type NewProps = { scope: ToolsScope; media?: MediaForTools };
type Props = NewProps | LegacyProps;

// Subset of useMediaRoom return shape — passed in optionally so the
// Screen Share + Recorder tools can drive the live media session.
export type MediaForTools = {
  joined: boolean;
  muted: boolean;
  cameraOn: boolean;
  toggleMute: () => void;
  setCameraEnabled: (on: boolean) => void;
  isScreenSharing: boolean;
  screenSharerId: string | null;
  startScreenShare: () => Promise<void> | void;
  stopScreenShare: () => Promise<void> | void;
};

export function WorkshopToolsPanel(props: Props) {
  const scope: ToolsScope = "scope" in props
    ? props.scope
    : { kind: "persistent", workshopId: props.workshopId, hostUserId: props.hostUserId, category: props.category };
  const media = "scope" in props ? props.media : undefined;

  const { user } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<StoredToolType | null>(null);
  const t = tables(scope);

  const { data: tools = [] } = useQuery({
    queryKey: ["ws-tools", scope.kind, t.parentId],
    enabled: !!user,
    queryFn: async () => {
      const selectCols = scope.kind === "instant"
        ? "id,tool_type,enabled,created_by_user_id"
        : "id,tool_type,enabled";
      const { data } = await (supabase.from(t.toolsTable) as any)
        .select(selectCols).eq(t.parentCol, t.parentId);
      return (data ?? []) as { id: string; tool_type: StoredToolType; enabled: boolean; created_by_user_id?: string | null }[];
    },
  });

  if (!user) return null;
  const isHost = scope.hostUserId !== null && user.id === scope.hostUserId;
  const canEnable = isHost || (scope.kind === "instant" && scope.hostUserId === null);
  const enabledTools = tools.filter((tool) => tool.enabled);
  const currentType: StoredToolType | null = active ?? enabledTools[0]?.tool_type ?? null;
  const currentTool = enabledTools.find((tool) => tool.tool_type === currentType);

  async function enableTool(type: ShippedToolType) {
    const payload: any = { [t.parentCol]: t.parentId, tool_type: type, enabled: true };
    if (scope.kind === "instant") payload.created_by_user_id = user!.id;
    const { error } = await (supabase.from(t.toolsTable) as any).insert(payload);
    if (error) return toast.error(error.message);
    setActive(type);
    qc.invalidateQueries({ queryKey: ["ws-tools", scope.kind, t.parentId] });
  }

  async function removeTool(toolId: string, toolType: StoredToolType) {
    const label = presetFor(toolType).label;
    const ok = typeof window === "undefined" ? true : window.confirm(`Remove ${label}? This deletes any items in it.`);
    if (!ok) return;
    const { error } = await (supabase.from(t.toolsTable) as any).delete().eq("id", toolId);
    if (error) return toast.error(error.message);
    if (active === toolType) setActive(null);
    qc.invalidateQueries({ queryKey: ["ws-tools", scope.kind, t.parentId] });
    toast.success(`${label} removed`);
  }

  const category: Category =
    scope.kind === "persistent" ? scope.category : (scope.category ?? "coworking");
  const suggested = CATEGORY_DEFAULTS[category];

  // Empty state: full picker with every tool visible. Coming-soon ones are disabled.
  if (enabledTools.length === 0) {
    if (!canEnable) {
      return (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-4 text-center text-sm text-ink-muted">
          No tools yet. The host can spin one up.
        </div>
      );
    }
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-border/60 bg-surface/60 backdrop-blur-sm p-4">
        <p className="text-sm text-ink-soft text-center">
          Spin up a shared surface. Realtime for live moments, Objects for things you keep.
        </p>
        <ToolGroup label="Realtime" types={TOOL_REALTIME} suggested={suggested} onEnable={enableTool} />
        <ToolGroup label="Objects" types={TOOL_OBJECTS} suggested={suggested} onEnable={enableTool} />
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-border">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-2 px-2 py-1.5">
        {enabledTools.map((tool) => {
          const P = presetFor(tool.tool_type);
          const Icon = P.icon;
          const isActive = currentType === tool.tool_type;
          const canRemove = isHost || (scope.kind === "instant" && tool.created_by_user_id === user!.id);
          return (
            <div
              key={tool.id}
              className={"inline-flex items-center rounded-full text-xs transition " +
                (isActive ? "bg-ink text-background" : "text-ink-soft hover:bg-muted")}
            >
              <button
                type="button"
                onClick={() => setActive(tool.tool_type)}
                className="inline-flex items-center gap-1.5 rounded-full pl-3 pr-2 py-1"
              >
                <Icon className="h-3.5 w-3.5" /> {P.label}
              </button>
              {canRemove && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeTool(tool.id, tool.tool_type); }}
                  aria-label={`Remove ${P.label}`}
                  title={`Remove ${P.label}`}
                  className={"mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full transition " +
                    (isActive ? "text-background/70 hover:bg-background/15 hover:text-background" : "text-ink-muted hover:bg-background hover:text-ink")}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
        {canEnable && (
          <AddToolMenu enabled={enabledTools.map((tool) => tool.tool_type)} onAdd={enableTool} />
        )}
      </div>
      {currentTool && <ActiveToolBody scope={scope} tool={currentTool} media={media} />}
    </div>
  );
}

function AddToolMenu({ enabled, onAdd }: { enabled: StoredToolType[]; onAdd: (t: ShippedToolType) => void }) {
  const [open, setOpen] = useState(false);
  // Treat any legacy shot_list/track_list as occupying the "list" slot.
  const occupied = new Set<StoredToolType>(enabled.map((e) => (e === "shot_list" || e === "track_list" ? "list" : e)));
  const available = TOOL_ORDER.filter((t) => !occupied.has(t as StoredToolType));
  if (available.length === 0) return null;
  return (
    <div className="relative ml-auto">
      <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-ink-muted hover:bg-muted">
        <Plus className="h-3 w-3" /> Tool
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-xl border border-border bg-surface p-1 shadow-lift">
          {available.map((type) => {
            const P = PRESETS[type];
            const Icon = P.icon;
            if (P.comingSoon) {
              return (
                <div key={type} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-muted opacity-60" title="Coming soon">
                  <Icon className="h-3.5 w-3.5" /> {P.label}
                  <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide">Soon</span>
                </div>
              );
            }
            return (
              <button key={type} onClick={() => { setOpen(false); onAdd(type as ShippedToolType); }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-soft hover:bg-muted">
                <Icon className="h-3.5 w-3.5" /> {P.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function toDocsScope(scope: ToolsScope): DocsScope {
  return scope.kind === "persistent"
    ? { kind: "persistent", workshopId: scope.workshopId }
    : { kind: "instant", roomId: scope.roomId };
}

function toDriveScope(scope: ToolsScope): DrivePanelScope {
  return scope.kind === "persistent"
    ? { kind: "persistent", workshopId: scope.workshopId }
    : { kind: "instant", roomId: scope.roomId };
}

function ActiveToolBody({ scope, tool, media }: { scope: ToolsScope; tool: { id: string; tool_type: StoredToolType }; media?: MediaForTools }) {
  const { user } = useAuth();
  // Dedicated full-featured components for the rich tools.
  if (tool.tool_type === "outline") {
    return (
      <div className="p-4">
        <WorkshopDocsEditor scope={toDocsScope(scope)} />
      </div>
    );
  }
  if (tool.tool_type === "drive") {
    return (
      <div className="p-4">
        <WorkshopDrivePanel scope={toDriveScope(scope)} />
      </div>
    );
  }
  if (tool.tool_type === "screen_share") {
    return (
      <div className="p-4">
        <WorkshopScreenSharePanel scope={scope.kind} media={media} />
      </div>
    );
  }
  if (tool.tool_type === "recorder") {
    const isHost = !!user && scope.hostUserId !== null && user.id === scope.hostUserId;
    return (
      <div className="p-4">
        <WorkshopRecordingLink
          scope={scope.kind === "instant"
            ? { kind: "instant", roomId: scope.roomId }
            : { kind: "persistent", workshopId: scope.workshopId }}
          toolId={tool.id}
          isHost={isHost}
        />
      </div>
    );
  }
  if (tool.tool_type === "pip") {
    return <PipBody />;
  }
  if (tool.tool_type === "board") {
    return <BoardBody scope={scope} />;
  }
  if (tool.tool_type === "player") {
    const playerScope = scope.kind === "instant"
      ? { kind: "instant" as const, roomId: scope.roomId, hostUserId: scope.hostUserId }
      : { kind: "persistent" as const, workshopId: scope.workshopId, hostUserId: scope.hostUserId };
    return <WorkshopPlayerTool scope={playerScope} toolId={tool.id} />;
  }
  // Lightweight primitives (Pinboard, List, Moodboard, Repo & Demo, legacy shot/track list).
  return <ToolItems scope={scope} tool={tool} />;
}

function BoardBody({ scope }: { scope: ToolsScope }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="p-2 h-[560px]">
      <RoomBoard
        scope={scope.kind === "instant"
          ? { kind: "instant", roomId: scope.roomId }
          : { kind: "persistent", workshopId: scope.workshopId }}
        userId={user.id}
        fullscreen
        className="h-full"
      />
    </div>
  );
}

function PipBody() {
  const supported = typeof window !== "undefined" && "documentPictureInPicture" in window;
  function openPip(source: "me" | "speaker" | "tool" | "director") {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("workshop:pip-open", { detail: { source } }));
  }
  const options: Array<{ id: "me" | "speaker" | "tool" | "director"; label: string; desc: string }> = [
    { id: "me", label: "Me", desc: "Your camera tile, front and center." },
    { id: "speaker", label: "Active speaker", desc: "Auto-follows whoever is talking." },
    { id: "tool", label: "Current tool", desc: "Whatever's in the main slot — screen share, board, player." },
    { id: "director", label: "Director", desc: "Cut between Tool, Split, and Cam (needs a live screen share)." },
  ];
  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet/10 text-violet">
            <PictureInPicture2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Picture-in-Picture</div>
            <h3 className="mt-0.5 font-display text-lg text-ink">Float the room above any tab</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Pop the Workshop into a small always-on-top window. Pick what shows in the floating tile — you can still switch sources after.
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => openPip(o.id)}
            disabled={!supported}
            className="text-left rounded-2xl border border-border bg-surface p-3 hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <div className="flex items-center gap-2 text-ink">
              <PictureInPicture2 className="h-3.5 w-3.5 text-violet" />
              <span className="font-medium text-sm">{o.label}</span>
            </div>
            <p className="mt-1 text-xs text-ink-soft">{o.desc}</p>
          </button>
        ))}
      </div>
      {!supported && (
        <p className="text-xs text-ink-muted">
          Always-on-top pop-out needs a Chromium-based browser (Chrome, Edge, Arc, Brave).
        </p>
      )}
    </div>
  );
}




function ToolItems({ scope, tool }: { scope: ToolsScope; tool: { id: string; tool_type: StoredToolType } }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const t = tables(scope);
  const preset = presetFor(tool.tool_type);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isInstant = scope.kind === "instant";
  const isList = tool.tool_type === "list" || tool.tool_type === "shot_list" || tool.tool_type === "track_list";
  // `done` only exists on instant_tool_items; persistent workshop_tool_items uses workshop_tasks for completion.
  const selectCols = isInstant
    ? `id,title,body,url,done,created_at,created_by_user_id, profile:profiles!${t.profileFk}(display_name,username,avatar_url)`
    : `id,title,body,url,created_at,created_by_user_id, profile:profiles!${t.profileFk}(display_name,username,avatar_url)`;

  const { data: items = [] } = useQuery({
    queryKey: ["ws-tool-items", scope.kind, tool.id],
    queryFn: async () => {
      const { data } = await (supabase.from(t.itemsTable) as any)
        .select(selectCols)
        .eq("tool_id", tool.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function toggleDone(it: any) {
    if (!isInstant) return;
    const { error } = await (supabase.from(t.itemsTable) as any).update({ done: !it.done }).eq("id", it.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["ws-tool-items", scope.kind, tool.id] });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const ti = title.trim(); const b = body.trim(); const u = url.trim();
    if (!ti && !b && !u) return;
    setSubmitting(true);
    const { error } = await (supabase.from(t.itemsTable) as any).insert({
      tool_id: tool.id, created_by_user_id: user.id,
      title: ti || null, body: b || null, url: u || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setTitle(""); setBody(""); setUrl("");
    qc.invalidateQueries({ queryKey: ["ws-tool-items", scope.kind, tool.id] });
  }

  async function remove(id: string) {
    const { error } = await (supabase.from(t.itemsTable) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["ws-tool-items", scope.kind, tool.id] });
  }

  const isMoodboard = tool.tool_type === "moodboard";
  const isHost = scope.hostUserId !== null && user?.id === scope.hostUserId;

  return (
    <div className="p-4">
      <form onSubmit={add} className="space-y-2">
        {preset.fields.includes("title") && (
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
            placeholder={preset.titlePlaceholder ?? "Title"} />
        )}
        {preset.fields.includes("body") && (
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={2000}
            placeholder={preset.bodyPlaceholder ?? "Notes…"} />
        )}
        {preset.fields.includes("url") && (
          <Input value={url} onChange={(e) => setUrl(e.target.value)} type="url" maxLength={500}
            placeholder={preset.urlPlaceholder ?? "https://…"} />
        )}
        <div className="flex justify-end">
          <Button type="submit" size="sm" className="rounded-full" disabled={submitting}>Add</Button>
        </div>
      </form>

      {items.length > 0 && (
        <div className={"mt-4 grid gap-2 " + (isMoodboard ? "grid-cols-2 sm:grid-cols-3" : "sm:grid-cols-2")}>
          {items.map((it: any) => {
            const name = it.profile?.display_name || it.profile?.username || "Anon";
            const canDelete = it.created_by_user_id === user?.id || isHost;
            if (isMoodboard && it.url) {
              return (
                <div key={it.id} className="group relative overflow-hidden rounded-xl border border-border bg-surface-2">
                  <img src={it.url} alt={it.title ?? ""} className="aspect-square w-full object-cover" />
                  {it.title && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-[11px] text-white">{it.title}</div>}
                  {canDelete && (
                    <button onClick={() => remove(it.id)}
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/50 p-1 text-white opacity-0 transition group-hover:opacity-100">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            }
            return (
              <div key={it.id} className="rounded-xl border border-border bg-surface-2 p-3">
                <div className="flex items-start gap-2">
                  {isList && isInstant && (
                    <button
                      onClick={() => toggleDone(it)}
                      className={
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition " +
                        (it.done ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary")
                      }
                      aria-label={it.done ? "Mark as open" : "Mark as done"}
                    >
                      {it.done && <Check className="h-2.5 w-2.5" />}
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    {it.title && (
                      <div className={"text-sm font-medium " + (isList && it.done ? "text-ink-muted line-through" : "text-ink")}>
                        {it.title}
                      </div>
                    )}
                    {it.body && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{it.body}</p>}
                    {it.url && (
                      <a href={it.url} target="_blank" rel="noreferrer noopener"
                        className="mt-1.5 inline-flex items-center gap-1 text-xs text-gradient-motion hover:underline">
                        {it.url.replace(/^https?:\/\//, "").slice(0, 40)} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-muted">
                  <Avatar className="h-4 w-4"><AvatarImage src={it.profile?.avatar_url ?? undefined} /><AvatarFallback className="text-[8px]">{name[0]}</AvatarFallback></Avatar>
                  <span>{name}</span>
                  {canDelete && (
                    <button onClick={() => remove(it.id)} className="ml-auto inline-flex items-center gap-0.5 hover:text-ink">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
