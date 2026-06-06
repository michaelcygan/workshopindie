import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pin, ListChecks, Music, FileText, Github, Image as ImageIcon, Trash2, Plus, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import type { Category } from "@/lib/categories";

type ToolType = "pinboard" | "shot_list" | "track_list" | "outline" | "repo_links" | "moodboard";

const PRESETS: Record<ToolType, {
  label: string; icon: typeof Pin; titlePlaceholder?: string; bodyPlaceholder?: string; urlPlaceholder?: string;
  fields: ("title" | "body" | "url")[];
}> = {
  pinboard:    { label: "Pinboard",    icon: Pin,        bodyPlaceholder: "Drop a reference, idea, or link…",  fields: ["body", "url"] },
  shot_list:   { label: "Shot List",   icon: ListChecks, titlePlaceholder: "Shot title (e.g. EXT. Rooftop, wide)", bodyPlaceholder: "Notes — framing, talent, blocking…", fields: ["title", "body"] },
  track_list:  { label: "Track List",  icon: Music,      titlePlaceholder: "Track or section",  urlPlaceholder: "Link (Splice, Drive, demo…)", fields: ["title", "url"] },
  outline:     { label: "Outline",     icon: FileText,   titlePlaceholder: "Section heading",   bodyPlaceholder: "Beats, ideas, draft text…", fields: ["title", "body"] },
  repo_links:  { label: "Repo & Demo", icon: Github,     titlePlaceholder: "Label",             urlPlaceholder: "Repo, demo, or doc URL", fields: ["title", "url"] },
  moodboard:   { label: "Moodboard",   icon: ImageIcon,  titlePlaceholder: "Caption",           urlPlaceholder: "Image URL (https://…)", fields: ["title", "url"] },
};

const CATEGORY_DEFAULTS: Record<Category, ToolType> = {
  film: "shot_list", music: "track_list", writing: "outline", build: "repo_links", visual: "moodboard",
  critique: "outline", business: "outline", coworking: "outline",
};

export type ToolsScope =
  | { kind: "persistent"; workshopId: string; hostUserId: string; category: Category }
  | { kind: "instant"; roomId: string; hostUserId: string | null; category?: Category | null };

// Table/column shim so the rest of the component stays scope-agnostic.
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
type NewProps = { scope: ToolsScope };
type Props = NewProps | LegacyProps;

export function WorkshopToolsPanel(props: Props) {
  const scope: ToolsScope = "scope" in props
    ? props.scope
    : { kind: "persistent", workshopId: props.workshopId, hostUserId: props.hostUserId, category: props.category };
  const { user } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<ToolType | null>(null);
  const t = tables(scope);

  const { data: tools = [] } = useQuery({
    queryKey: ["ws-tools", scope.kind, t.parentId],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from(t.toolsTable)
        .select("id,tool_type,enabled").eq(t.parentCol, t.parentId);
      return (data ?? []) as { id: string; tool_type: ToolType; enabled: boolean }[];
    },
  });

  if (!user) return null;
  const isHost = scope.hostUserId !== null && user.id === scope.hostUserId;
  // Leaderless instant rooms: anyone present can enable tools.
  const canEnable = isHost || (scope.kind === "instant" && scope.hostUserId === null);
  const enabledTools = tools.filter((t) => t.enabled);
  const currentType: ToolType | null = active ?? enabledTools[0]?.tool_type ?? null;
  const currentTool = enabledTools.find((tool) => tool.tool_type === currentType);

  async function enableTool(type: ToolType) {
    const payload: any = { [t.parentCol]: t.parentId, tool_type: type, enabled: true };
    if (scope.kind === "instant") payload.created_by_user_id = user!.id;
    const { error } = await supabase.from(t.toolsTable).insert(payload);
    if (error) return toast.error(error.message);
    setActive(type);
    qc.invalidateQueries({ queryKey: ["ws-tools", scope.kind, t.parentId] });
  }

  const category: Category =
    scope.kind === "persistent" ? scope.category : (scope.category ?? "coworking");
  const suggested = CATEGORY_DEFAULTS[category];

  if (enabledTools.length === 0) {
    if (!canEnable) {
      return (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-4 text-center text-sm text-ink-muted">
          No tools yet. The host can spin one up.
        </div>
      );
    }
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-border p-4 text-center">
        <p className="text-sm text-ink-muted">Enable a shared tool so the Workshop can collect ideas, shots, links, and references.</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button size="sm" className="rounded-full gap-1.5" onClick={() => enableTool(suggested)}>
            <Plus className="h-3.5 w-3.5" /> {PRESETS[suggested].label} <span className="text-[11px] opacity-70">· suggested</span>
          </Button>
          <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => enableTool("pinboard")}>
            <Pin className="h-3.5 w-3.5" /> Pinboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-border">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-2 px-2 py-1.5">
        {enabledTools.map((tool) => {
          const P = PRESETS[tool.tool_type];
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
        {canEnable && enabledTools.length < 6 && (
          <AddToolMenu enabled={enabledTools.map((tool) => tool.tool_type)} onAdd={enableTool} />
        )}
      </div>
      {currentTool && <ToolItems scope={scope} tool={currentTool} />}
    </div>
  );
}

function AddToolMenu({ enabled, onAdd }: { enabled: ToolType[]; onAdd: (t: ToolType) => void }) {
  const [open, setOpen] = useState(false);
  const available = (Object.keys(PRESETS) as ToolType[]).filter((t) => !enabled.includes(t));
  if (available.length === 0) return null;
  return (
    <div className="relative ml-auto">
      <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-ink-muted hover:bg-muted">
        <Plus className="h-3 w-3" /> Tool
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-xl border border-border bg-surface p-1 shadow-lift">
          {available.map((t) => {
            const P = PRESETS[t];
            const Icon = P.icon;
            return (
              <button key={t} onClick={() => { setOpen(false); onAdd(t); }}
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

function ToolItems({ scope, tool }: { scope: ToolsScope; tool: { id: string; tool_type: ToolType } }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const t = tables(scope);
  const preset = PRESETS[tool.tool_type];
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["ws-tool-items", scope.kind, tool.id],
    queryFn: async () => {
      const { data } = await supabase.from(t.itemsTable)
        .select(`id,title,body,url,created_at,created_by_user_id, profile:profiles!${t.profileFk}(display_name,username,avatar_url)`)
        .eq("tool_id", tool.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const ti = title.trim(); const b = body.trim(); const u = url.trim();
    if (!ti && !b && !u) return;
    setSubmitting(true);
    const { error } = await supabase.from(t.itemsTable).insert({
      tool_id: tool.id, created_by_user_id: user.id,
      title: ti || null, body: b || null, url: u || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setTitle(""); setBody(""); setUrl("");
    qc.invalidateQueries({ queryKey: ["ws-tool-items", scope.kind, tool.id] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from(t.itemsTable).delete().eq("id", id);
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
                {it.title && <div className="text-sm font-medium text-ink">{it.title}</div>}
                {it.body && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{it.body}</p>}
                {it.url && (
                  <a href={it.url} target="_blank" rel="noreferrer noopener"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-gradient-motion hover:underline">
                    {it.url.replace(/^https?:\/\//, "").slice(0, 40)} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
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
