import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Loader2, Maximize2, Minimize2, MoreHorizontal, Trash2,
  ArrowUp, ArrowDown, Bold, Italic, Link2, Heading1, Heading2, List as ListIcon, Quote, Code,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/**
 * Collaborative Docs editor — single writing surface, no preview/split toggle.
 * Backs onto `workshop_docs` (persistent) or `instant_docs` (live room).
 *
 * Design: one canvas, paper feel, generous type. Markdown shortcuts still work
 * (`# `, `## `, `- `, `> `, `**…**`, `_…_`, `[text](url)`) and a floating
 * selection toolbar surfaces formatting on demand. Autosave runs in the
 * background with a tiny status line.
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
      title: "",
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
      <div className="flex justify-center py-16">
        <Loader2 className="h-4 w-4 animate-spin text-ink-muted" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-surface px-8 py-16 text-center">
        <p className="font-display text-lg text-ink">A blank page for the room.</p>
        <p className="mt-1 text-sm text-ink-muted">Notes, drafts, scripts — autosaves as you type.</p>
        <Button onClick={addDoc} className="mt-6 rounded-full gap-2 px-5">
          <Plus className="h-4 w-4" /> Start writing
        </Button>
      </div>
    );
  }

  const docIdx = docs.findIndex((d) => d.id === (active?.id ?? ""));

  return (
    <div className={cn(fullscreen && "fixed inset-0 z-50 bg-background overflow-auto")}>
      <div className={cn(
        "grid gap-6",
        fullscreen ? "md:grid-cols-[220px_1fr] min-h-screen p-6" : "md:grid-cols-[200px_1fr]",
      )}>
        <aside className="space-y-0.5">
          {docs.map((d, idx) => (
            <div key={d.id} className="group flex items-center gap-0.5">
              <button
                onClick={() => setActiveId(d.id)}
                className={cn(
                  "flex-1 truncate rounded-lg px-2.5 py-1.5 text-left text-[13px] transition",
                  (active?.id ?? "") === d.id
                    ? "bg-ink text-background"
                    : "text-ink-soft hover:bg-muted",
                )}
              >
                {d.title?.trim() || "Untitled"}
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
            </div>
          ))}
          <button
            onClick={addDoc}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-muted hover:bg-muted hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </aside>

        {active && (
          <DocEditor
            key={active.id}
            doc={active}
            tableName={t.name}
            fullscreen={fullscreen}
            canMoveUp={docIdx > 0}
            canMoveDown={docIdx < docs.length - 1}
            onToggleFullscreen={() => setFullscreen((v) => !v)}
            onMoveUp={() => reorder(active, -1)}
            onMoveDown={() => reorder(active, 1)}
            onDelete={() => removeDoc(active.id)}
          />
        )}
      </div>
    </div>
  );
}

function DocEditor({
  doc,
  tableName,
  fullscreen,
  canMoveUp,
  canMoveDown,
  onToggleFullscreen,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  doc: Doc;
  tableName: "workshop_docs" | "instant_docs";
  fullscreen: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleFullscreen: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.content_md);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(new Date(doc.updated_at));
  const [bar, setBar] = useState<{ x: number; y: number } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitle(doc.title);
    setBody(doc.content_md);
    setDirty(false);
    setSavedAt(new Date(doc.updated_at));
  }, [doc.id, doc.title, doc.content_md, doc.updated_at]);

  useEffect(() => {
    if (!dirty) return;
    const tm = setTimeout(save, 700);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, dirty]);

  async function save() {
    setSaving(true);
    const { error } = await (supabase.from(tableName) as any)
      .update({ title: title.trim(), content_md: body })
      .eq("id", doc.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setDirty(false);
    setSavedAt(new Date());
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

  // Floating selection bar — appears above the current text selection.
  function updateBarFromSelection() {
    const ta = taRef.current;
    const wrap = wrapRef.current;
    if (!ta || !wrap) { setBar(null); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) { setBar(null); return; }
    // Position bar just above the textarea, horizontally centered on selection.
    const taRect = ta.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    // Approximate caret x by measuring offset in a mirror is heavy; center over the textarea instead.
    setBar({
      x: taRect.left - wrapRect.left + taRect.width / 2,
      y: taRect.top - wrapRect.top - 6,
    });
  }

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const status = saving ? "Saving…" : dirty ? "Unsaved" : savedAt
    ? `Saved · ${savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : "Saved";

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative rounded-3xl border border-border bg-surface flex flex-col",
        fullscreen ? "min-h-[calc(100vh-3rem)]" : "min-h-[520px]",
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-8 pt-8 pb-2">
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          placeholder="Untitled"
          maxLength={200}
          className="flex-1 min-w-0 border-none bg-transparent p-0 font-display text-3xl md:text-4xl tracking-tight text-ink placeholder:text-ink-muted/50 focus:outline-none focus:ring-0"
        />
        <div className="mt-2 flex items-center gap-1 shrink-0">
          <span className="hidden sm:inline text-[11px] text-ink-muted tabular-nums px-1">{status}</span>
          <Button
            onClick={onToggleFullscreen}
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full text-ink-muted hover:text-ink"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-ink-muted hover:text-ink" title="More" aria-label="More document actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onMoveUp} disabled={!canMoveUp}>
                <ArrowUp className="h-3.5 w-3.5 mr-2" /> Move up
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onMoveDown} disabled={!canMoveDown}>
                <ArrowDown className="h-3.5 w-3.5 mr-2" /> Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete doc
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Writing surface */}
      <div className="relative flex-1 min-h-0 px-8 pb-6">
        {bar && (
          <div
            style={{ left: bar.x, top: bar.y }}
            className="absolute z-10 -translate-x-1/2 -translate-y-full rounded-full border border-border bg-background/95 backdrop-blur px-1 py-1 shadow-lift flex items-center gap-0.5"
            onMouseDown={(e) => e.preventDefault()}
          >
            <BarBtn onClick={() => wrap("**")} title="Bold (⌘B)"><Bold className="h-3.5 w-3.5" /></BarBtn>
            <BarBtn onClick={() => wrap("_")} title="Italic (⌘I)"><Italic className="h-3.5 w-3.5" /></BarBtn>
            <BarBtn onClick={insertLink} title="Link (⌘K)"><Link2 className="h-3.5 w-3.5" /></BarBtn>
            <span className="mx-1 h-4 w-px bg-border" />
            <BarBtn onClick={() => prefixLine("# ")} title="Heading 1"><Heading1 className="h-3.5 w-3.5" /></BarBtn>
            <BarBtn onClick={() => prefixLine("## ")} title="Heading 2"><Heading2 className="h-3.5 w-3.5" /></BarBtn>
            <BarBtn onClick={() => prefixLine("- ")} title="List"><ListIcon className="h-3.5 w-3.5" /></BarBtn>
            <BarBtn onClick={() => prefixLine("> ")} title="Quote"><Quote className="h-3.5 w-3.5" /></BarBtn>
            <BarBtn onClick={() => wrap("`")} title="Code"><Code className="h-3.5 w-3.5" /></BarBtn>
          </div>
        )}

        <textarea
          ref={taRef}
          value={body}
          onChange={(e) => { setBody(e.target.value); setDirty(true); }}
          onKeyDown={onKeyDown}
          onSelect={updateBarFromSelection}
          onMouseUp={updateBarFromSelection}
          onBlur={() => setTimeout(() => setBar(null), 120)}
          placeholder="Start writing. Markdown shortcuts work — try # for a heading, - for a list, or select text to format."
          spellCheck
          className={cn(
            "w-full resize-none border-none bg-transparent p-0 text-[15px] leading-[1.75] text-ink",
            "placeholder:text-ink-muted/60 focus:outline-none focus:ring-0",
            fullscreen ? "min-h-[calc(100vh-12rem)]" : "min-h-[380px]",
          )}
          style={{ fontFamily: "var(--font-body, ui-sans-serif, system-ui)" }}
        />
      </div>

      <div className="px-8 pb-4 flex items-center justify-between text-[11px] text-ink-muted">
        <span>{words} {words === 1 ? "word" : "words"}</span>
        <span className="sm:hidden">{status}</span>
        <span className="hidden sm:inline">Last edited {savedAt ? savedAt.toLocaleString() : "—"}</span>
      </div>
    </div>
  );
}

function BarBtn({
  onClick, title, children,
}: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-soft hover:bg-muted hover:text-ink"
    >
      {children}
    </button>
  );
}
