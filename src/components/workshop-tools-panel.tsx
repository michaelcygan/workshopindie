import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Pin, ListChecks, FileText, Github, Image as ImageIcon, Trash2, Plus, ExternalLink, Check,
  FolderOpen, MonitorPlay, PenLine, Mic,
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
import { WorkshopRecorder } from "@/components/workshop-recorder";
import { WorkshopScreenSharePanel } from "@/components/workshop-screen-share-panel";

// Shipped tools (enable-able today). `outline` is the stored value behind the "Docs" label.
type ShippedToolType = "pinboard" | "list" | "outline" | "drive" | "repo_links" | "moodboard" | "screen_share" | "recorder";
// Tools on the roadmap, surfaced as disabled "Coming soon" chips so users know they're planned.
type ComingSoonToolType = "board";
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

// Order here drives chip order in the picker. Shipped tools first.
const PRESETS: Record<ToolType, Preset> = {
  outline:      { label: "Docs",         icon: FileText,    blurb: "Collaborative notes, drafts, scripts.", fields: [] },
  pinboard:     { label: "Pinboard",     icon: Pin,         blurb: "References, ideas, links.",      bodyPlaceholder: "Drop a reference, idea, or link…",  fields: ["body", "url"] },
  list:         { label: "List",         icon: ListChecks,  blurb: "To-dos, shots, tracks — any list.", titlePlaceholder: "What's on the list?", urlPlaceholder: "Optional link",          fields: ["title", "body", "url"] },
  drive:        { label: "Drive",        icon: FolderOpen,  blurb: "Share cloud links and recordings.", fields: [] },
  moodboard:    { label: "Moodboard",    icon: ImageIcon,   blurb: "Visual references.",             titlePlaceholder: "Caption",           urlPlaceholder: "Image URL (https://…)", fields: ["title", "url"] },
  repo_links:   { label: "Repo & Demo",  icon: Github,      blurb: "Code repos and live demos.",     titlePlaceholder: "Label",             urlPlaceholder: "Repo, demo, or doc URL", fields: ["title", "url"] },
  screen_share: { label: "Screen Share", icon: MonitorPlay, blurb: "Share your screen with everyone in the room.", fields: [] },
  recorder:     { label: "Recorder",     icon: Mic,         blurb: "Capture takes — saved to Drive.", fields: [] },
  board:        { label: "Board",        icon: PenLine,     blurb: "Realtime whiteboard.",            comingSoon: true, fields: [] },
};

const TOOL_ORDER: ToolType[] = ["outline", "pinboard", "list", "drive", "moodboard", "repo_links", "screen_share", "recorder", "board"];


const CATEGORY_DEFAULTS: Record<Category, ShippedToolType> = {
  film: "list", music: "list", writing: "outline", build: "repo_links", visual: "moodboard",
  critique: "outline", business: "outline", coworking: "outline",
};

// Stored value mapping — UI label "List" stores tool_type='list'.
// Legacy rows with tool_type='shot_list' / 'track_list' are still rendered as List below.
type StoredToolType = ShippedToolType | "shot_list" | "track_list";

function presetFor(stored: StoredToolType): Preset {
  if (stored === "shot_list" || stored === "track_list") return PRESETS.list;
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
      const { data } = await (supabase.from(t.toolsTable) as any)
        .select("id,tool_type,enabled").eq(t.parentCol, t.parentId);
      return (data ?? []) as { id: string; tool_type: StoredToolType; enabled: boolean }[];
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
      <div className="mt-4 rounded-2xl border border-dashed border-border p-4">
        <p className="text-sm text-ink-muted text-center">
          Spin up a shared tool — Docs, Pinboard, List, Drive, Moodboard, Repo & Demo. Add as many as you need.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TOOL_ORDER.map((type) => {
            const P = PRESETS[type];
            const Icon = P.icon;
            const isSuggested = type === suggested;
            if (P.comingSoon) {
              return (
                <button
                  key={type}
                  disabled
                  title="Coming soon"
                  className="group flex flex-col items-start gap-1 rounded-xl border border-border bg-surface-2/50 p-3 text-left opacity-60 cursor-not-allowed"
                >
                  <div className="flex w-full items-center gap-2">
                    <Icon className="h-4 w-4 text-ink-muted" />
                    <span className="text-sm font-medium text-ink-soft">{P.label}</span>
                    <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-ink-muted">Soon</span>
                  </div>
                  <p className="text-[11px] leading-tight text-ink-muted">{P.blurb}</p>
                </button>
              );
            }
            return (
              <button
                key={type}
                onClick={() => enableTool(type as ShippedToolType)}
                className={
                  "group flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-soft " +
                  (isSuggested ? "border-primary/40 bg-primary/5" : "border-border bg-surface")
                }
              >
                <div className="flex w-full items-center gap-2">
                  <Icon className="h-4 w-4 text-ink" />
                  <span className="text-sm font-medium text-ink">{P.label}</span>
                  {isSuggested && (
                    <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-primary">Suggested</span>
                  )}
                </div>
                <p className="text-[11px] leading-tight text-ink-muted">{P.blurb}</p>
              </button>
            );
          })}
        </div>
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
          return (
            <button key={tool.id} onClick={() => setActive(tool.tool_type)}
              className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition " +
                (isActive ? "bg-ink text-background" : "text-ink-soft hover:bg-muted")}>
              <Icon className="h-3.5 w-3.5" /> {P.label}
            </button>
          );
        })}
        {canEnable && (
          <AddToolMenu enabled={enabledTools.map((tool) => tool.tool_type)} onAdd={enableTool} />
        )}
      </div>
      {currentTool && <ActiveToolBody scope={scope} tool={currentTool} />}
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

function ActiveToolBody({ scope, tool }: { scope: ToolsScope; tool: { id: string; tool_type: StoredToolType } }) {
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
  // Lightweight primitives (Pinboard, List, Moodboard, Repo & Demo, legacy shot/track list).
  return <ToolItems scope={scope} tool={tool} />;
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
