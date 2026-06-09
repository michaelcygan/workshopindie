import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Plus, Save, Trash2, Loader2, Eye, Pencil, Bold, Italic, Heading1, Heading2,
  List as ListIcon, Link2, Code, Quote, Maximize2, Minimize2, ArrowUp, ArrowDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Polymorphic collaborative Docs editor. Backs onto either:
 *  - `workshop_docs` (persistent Workshop, scoped by workshop_id), or
 *  - `instant_docs`  (live room, scoped by room_id).
 *
 * Features: formatting toolbar, live markdown preview, word count, reorder,
 * fullscreen, autosave with status indicator.
 */
export type DocsScope =
  | { kind: "persistent"; workshopId: string }
  | { kind: "instant"; roomId: string };

type Doc = {
  id: string;
  title: string;
  content_md: string;
  sort_order: number;
  updated_at: string;
};

function tableFor(scope: DocsScope) {
  return scope.kind === "persistent"
    ? { name: "workshop_docs" as const, parentCol: "workshop_id" as const, parentId: scope.workshopId, createdByCol: "created_by" as const }
    : { name: "instant_docs"  as const, parentCol: "room_id"     as const, parentId: scope.roomId,     createdByCol: "created_by" as const };
}

export function WorkshopDocsEditor({ scope }: { scope: DocsScope }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const t = tableFor(scope);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const queryKey = ["docs", scope.kind, t.parentId] as const;

  const { data: docs = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await (supabase.from(t.name) as any)
        .select("id,title,content_md,sort_order,updated_at")
        .eq(t.parentCol, t.parentId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      return (data as Doc[]) ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`docs-${scope.kind}-${t.parentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: t.name, filter: `${t.parentCol}=eq.${t.parentId}` },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [scope.kind, t.name, t.parentCol, t.parentId, qc]);

  const active = useMemo(
    () => docs.find((d) => d.id === activeId) ?? docs[0] ?? null,
    [docs, activeId],
  );

  async function addDoc() {
    if (!user) return;
    const nextOrder = (docs[docs.length - 1]?.sort_order ?? 0) + 1;
    const payload: any = {
      [t.parentCol]: t.parentId,
      [t.createdByCol]: user.id,
      title: "Untitled",
      content_md: "",
      sort_order: nextOrder,
    };
    const { data, error } = await (supabase.from(t.name) as any).insert(payload).select("id").single();
    if (error) return toast.error(error.message);
    setActiveId(data.id);
  }

  async function removeDoc(id: string) {
    if (!confirm("Delete this doc?")) return;
    const { error } = await (supabase.from(t.name) as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    if (id === activeId) setActiveId(null);
  }

  async function reorder(doc: Doc, dir: -1 | 1) {
    const idx = docs.findIndex((d) => d.id === doc.id);
    const swap = docs[idx + dir];
    if (!swap) return;
    await Promise.all([
      (supabase.from(t.name) as any).update({ sort_order: swap.sort_order }).eq("id", doc.id),
      (supabase.from(t.name) as any).update({ sort_order: doc.sort_order }).eq("id", swap.id),
    ]);
    qc.invalidateQueries({ queryKey });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-4 w-4 animate-spin text-ink-muted" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-sm text-ink-muted">No docs yet.</p>
        <Button onClick={addDoc} className="mt-4 rounded-full gap-2">
          <Plus className="h-4 w-4" /> Start a doc
        </Button>
      </div>
    );
  }

  const container = fullscreen
    ? "fixed inset-0 z-50 bg-background p-4 md:p-6 overflow-auto"
    : "";

  return (
    <div className={container}>
      <div className={cn("grid gap-4", fullscreen ? "md:grid-cols-[240px_1fr] h-full" : "md:grid-cols-[200px_1fr]")}>
        <aside className="rounded-2xl border border-border bg-surface p-2">
          <ul className="space-y-0.5">
            {docs.map((d, idx) => (
              <li key={d.id} className="group flex items-center gap-1">
                <button
                  onClick={() => setActiveId(d.id)}
                  className={cn(
                    "flex-1 truncate rounded-xl px-3 py-2 text-left text-sm transition",
                    (active?.id ?? "") === d.id ? "bg-muted text-ink" : "text-ink-soft hover:bg-muted/50",
                  )}
                >
                  {d.title || "Untitled"}
                </button>
                <div className="opacity-0 transition group-hover:opacity-100 flex flex-col">
                  <button
                    onClick={() => reorder(d, -1)}
                    disabled={idx === 0}
                    className="text-ink-muted hover:text-ink disabled:opacity-30 px-0.5"
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => reorder(d, 1)}
                    disabled={idx === docs.length - 1}
                    className="text-ink-muted hover:text-ink disabled:opacity-30 px-0.5"
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Button
            onClick={addDoc}
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-start rounded-xl text-ink-muted hover:text-ink"
          >
            <Plus className="h-4 w-4" /> New doc
          </Button>
        </aside>

        {active && (
          <DocEditor
            key={active.id}
            doc={active}
            tableName={t.name}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen((v) => !v)}
            onDelete={() => removeDoc(active.id)}
          />
        )}
      </div>
    </div>
  );
}

type ViewMode = "edit" | "preview" | "split";

function DocEditor({
  doc,
  tableName,
  fullscreen,
  onToggleFullscreen,
  onDelete,
}: {
  doc: Doc;
  tableName: "workshop_docs" | "instant_docs";
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.content_md);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<ViewMode>("edit");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTitle(doc.title);
    setBody(doc.content_md);
    setDirty(false);
  }, [doc.id, doc.title, doc.content_md]);

  useEffect(() => {
    if (!dirty) return;
    const tm = setTimeout(save, 800);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, dirty]);

  async function save() {
    setSaving(true);
    const { error } = await (supabase.from(tableName) as any)
      .update({ title: title.trim() || "Untitled", content_md: body })
      .eq("id", doc.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setDirty(false);
  }

  function wrap(before: string, after: string = before) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = body.slice(start, end);
    const next = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(next);
    setDirty(true);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, end + before.length);
    });
  }

  function prefixLine(prefix: string) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = body.lastIndexOf("\n", start - 1) + 1;
    const next = body.slice(0, lineStart) + prefix + body.slice(lineStart);
    setBody(next);
    setDirty(true);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  }

  function insertLink() {
    const url = window.prompt("Link URL");
    if (!url) return;
    wrap("[", `](${url})`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      if (e.key === "s") { e.preventDefault(); save(); return; }
      if (e.key === "b") { e.preventDefault(); wrap("**"); return; }
      if (e.key === "i") { e.preventDefault(); wrap("_"); return; }
      if (e.key === "k") { e.preventDefault(); insertLink(); return; }
    }
  }

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const chars = body.length;

  return (
    <div className={cn("rounded-2xl border border-border bg-surface p-4 flex flex-col", fullscreen && "h-full")}>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          className="flex-1 min-w-[160px] border-none bg-transparent px-0 text-lg font-display focus-visible:ring-0"
          placeholder="Untitled"
          maxLength={200}
        />
        <span className="text-xs text-ink-muted">
          {saving ? "Saving…" : dirty ? "Unsaved" : "Saved"}
        </span>
        <div className="inline-flex rounded-full bg-muted p-0.5">
          <button
            onClick={() => setView("edit")}
            className={cn("rounded-full px-2 py-1 text-xs", view === "edit" ? "bg-background text-ink" : "text-ink-muted hover:text-ink")}
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={() => setView("split")}
            className={cn("rounded-full px-2 py-1 text-xs", view === "split" ? "bg-background text-ink" : "text-ink-muted hover:text-ink")}
            title="Split"
          >
            <span className="text-[10px] font-medium">Split</span>
          </button>
          <button
            onClick={() => setView("preview")}
            className={cn("rounded-full px-2 py-1 text-xs", view === "preview" ? "bg-background text-ink" : "text-ink-muted hover:text-ink")}
            title="Preview"
          >
            <Eye className="h-3 w-3" />
          </button>
        </div>
        <Button onClick={save} size="sm" variant="ghost" className="rounded-full" disabled={!dirty || saving} title="Save (⌘S)">
          <Save className="h-3.5 w-3.5" />
        </Button>
        <Button onClick={onToggleFullscreen} size="sm" variant="ghost" className="rounded-full" title="Fullscreen">
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </Button>
        <Button
          onClick={onDelete}
          size="sm"
          variant="ghost"
          className="rounded-full text-ink-muted hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {view !== "preview" && (
        <div className="mt-2 flex flex-wrap items-center gap-0.5 border-b border-border pb-2">
          <ToolbarBtn onClick={() => wrap("**")} title="Bold (⌘B)"><Bold className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => wrap("_")} title="Italic (⌘I)"><Italic className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => prefixLine("# ")} title="Heading 1"><Heading1 className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => prefixLine("## ")} title="Heading 2"><Heading2 className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => prefixLine("- ")} title="Bulleted list"><ListIcon className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => prefixLine("> ")} title="Quote"><Quote className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={() => wrap("`")} title="Inline code"><Code className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn onClick={insertLink} title="Link (⌘K)"><Link2 className="h-3.5 w-3.5" /></ToolbarBtn>
        </div>
      )}

      <div className={cn("mt-3 flex-1 min-h-0", view === "split" ? "grid gap-3 md:grid-cols-2" : "")}>
        {view !== "preview" && (
          <Textarea
            ref={taRef}
            value={body}
            onChange={(e) => { setBody(e.target.value); setDirty(true); }}
            onKeyDown={onKeyDown}
            rows={fullscreen ? 28 : 16}
            placeholder="Start writing. Markdown is fine. ⌘B bold · ⌘I italic · ⌘K link · ⌘S save"
            className={cn(
              "resize-y border-none bg-transparent px-0 focus-visible:ring-0 font-mono text-sm",
              fullscreen && "h-full",
            )}
          />
        )}
        {(view === "preview" || view === "split") && (
          <div className={cn(
            "prose prose-sm dark:prose-invert max-w-none overflow-auto rounded-xl border border-border bg-surface-2/40 p-4",
            fullscreen && "h-full",
          )}>
            {body.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            ) : (
              <p className="text-sm text-ink-muted">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-muted">
        <span>{words} {words === 1 ? "word" : "words"} · {chars} chars</span>
        <span>Last updated {new Date(doc.updated_at).toLocaleString()}</span>
      </div>
    </div>
  );
}

function ToolbarBtn({
  onClick, title, children,
}: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-soft hover:bg-muted hover:text-ink"
    >
      {children}
    </button>
  );
}
