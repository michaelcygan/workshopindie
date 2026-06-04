import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Upload, Trash2, Plus, ExternalLink, Loader2, FileText, Download,
  Check, X, Copy, Link as LinkIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getWorkTools,
  listWorkFiles, registerWorkFile, deleteWorkFile, signedFileUrl,
  listWorkDocs, upsertWorkDoc, deleteWorkDoc,
  listWorkTasks, addWorkTask, toggleWorkTask, deleteWorkTask,
  listWorkLinks, addWorkLink, deleteWorkLink,
  listWorkActivity,
  createWorkInviteToken, setWorkVisibility,
} from "@/lib/work-tools.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const VALID_TOOLS = ["files", "notepad", "tasks", "links", "activity", "rights"] as const;
type Tool = typeof VALID_TOOLS[number];

export const Route = createFileRoute("/works/$slug/tools/$tool")({
  component: ToolView,
});

function ToolView() {
  const { slug, tool } = Route.useParams();
  if (!VALID_TOOLS.includes(tool as Tool)) {
    return <Empty title="Unknown tool" body="Pick a tool from the sidebar." />;
  }
  return <ToolBody slug={slug} tool={tool as Tool} />;
}

function ToolBody({ slug, tool }: { slug: string; tool: Tool }) {
  const fetchTools = useServerFn(getWorkTools);
  const { data } = useQuery({
    queryKey: ["work-tools", slug],
    queryFn: () => fetchTools({ data: { slug } }),
    retry: false,
  });
  if (!data) return <div className="text-muted-foreground">Loading…</div>;
  const workId = data.work.id;
  const isOwner = data.isOwner;

  switch (tool) {
    case "files":    return <FilesTool workId={workId} />;
    case "notepad":  return <NotepadTool workId={workId} />;
    case "tasks":    return <TasksTool workId={workId} />;
    case "links":    return <LinksTool workId={workId} />;
    case "activity": return <ActivityTool workId={workId} />;
    case "rights":   return <RightsTool workId={workId} isOwner={isOwner} agreement={data.agreement} collaborators={data.collaborators} visibility={data.work.visibility} slug={slug} />;
  }
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <Card className="p-8 text-center">
      <h2 className="text-lg font-medium mb-1">{title}</h2>
      <p className="text-sm text-muted-foreground">{body}</p>
    </Card>
  );
}

// ============================================================================
// FILES
// ============================================================================

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function FilesTool({ workId }: { workId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listWorkFiles);
  const registerFn = useServerFn(registerWorkFile);
  const deleteFn = useServerFn(deleteWorkFile);
  const signFn = useServerFn(signedFileUrl);
  const { data, isLoading } = useQuery({
    queryKey: ["work-files", workId],
    queryFn: () => listFn({ data: { workId } }),
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        setProgress({ name: f.name, pct: 0 });
        const path = `${workId}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("work-files")
          .upload(path, f, { upsert: false, contentType: f.type || "application/octet-stream" });
        if (upErr) throw new Error(upErr.message);
        await registerFn({
          data: {
            workId,
            path,
            name: f.name,
            size_bytes: f.size,
            mime: f.type || null,
          },
        });
        setProgress({ name: f.name, pct: 100 });
      }
      toast.success("Uploaded");
      qc.invalidateQueries({ queryKey: ["work-files", workId] });
      qc.invalidateQueries({ queryKey: ["work-tools"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDownload(fileId: string) {
    try {
      const { url } = await signFn({ data: { fileId } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  }

  async function handleDelete(fileId: string) {
    if (!confirm("Delete this file? This can't be undone.")) return;
    try {
      await deleteFn({ data: { fileId } });
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["work-files", workId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Files</h2>
          <p className="text-xs text-muted-foreground">
            Drag and drop. Up to 2 GB per Work in v1.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
          Upload
        </Button>
      </div>

      {progress && (
        <Card className="p-3 text-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="truncate">{progress.name}</span>
            <span className="text-muted-foreground">{progress.pct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading files…</p>
      ) : !data?.files.length ? (
        <Empty title="No files yet" body="Upload anything: stems, cuts, scripts, demos, references." />
      ) : (
        <div className="space-y-2">
          {data.files.map((f) => (
            <Card key={f.id} className="p-3 flex items-center gap-3">
              <FileText className="size-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(f.size_bytes)} · uploaded by {f.profiles?.display_name ?? f.profiles?.username ?? "someone"} {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => handleDownload(f.id)}>
                <Download className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(f.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// NOTEPAD
// ============================================================================

function NotepadTool({ workId }: { workId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listWorkDocs);
  const saveFn = useServerFn(upsertWorkDoc);
  const deleteFn = useServerFn(deleteWorkDoc);
  const { data } = useQuery({
    queryKey: ["work-docs", workId],
    queryFn: () => listFn({ data: { workId } }),
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!data) return;
    if (!activeId && data.docs[0]) {
      setActiveId(data.docs[0].id);
      setTitle(data.docs[0].title);
      const c = data.docs[0].content as { text?: string } | null;
      setBody(c?.text ?? "");
      setDirty(false);
    }
  }, [data, activeId]);

  // Realtime: re-fetch on doc changes for this work
  useEffect(() => {
    const ch = supabase
      .channel(`work-docs-${workId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "work_docs", filter: `work_id=eq.${workId}` }, () => {
        qc.invalidateQueries({ queryKey: ["work-docs", workId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workId, qc]);

  function scheduleSave(nextTitle: string, nextBody: string) {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await saveFn({
          data: { workId, docId: activeId, title: nextTitle || "Untitled", content: nextBody },
        });
        setDirty(false);
        if (!activeId) setActiveId(res.docId);
        qc.invalidateQueries({ queryKey: ["work-docs", workId] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    }, 800);
  }

  async function newDoc() {
    setActiveId(null);
    setTitle("Untitled");
    setBody("");
    setDirty(false);
  }

  async function selectDoc(id: string) {
    const d = data?.docs.find((x) => x.id === id);
    if (!d) return;
    setActiveId(id);
    setTitle(d.title);
    const c = d.content as { text?: string } | null;
    setBody(c?.text ?? "");
    setDirty(false);
  }

  async function removeDoc(id: string) {
    if (!confirm("Delete this note?")) return;
    try {
      await deleteFn({ data: { docId: id } });
      if (activeId === id) {
        setActiveId(null);
        setTitle("");
        setBody("");
      }
      qc.invalidateQueries({ queryKey: ["work-docs", workId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-4">
      <aside className="space-y-2">
        <Button size="sm" variant="outline" className="w-full" onClick={newDoc}>
          <Plus className="size-3.5 mr-1" /> New note
        </Button>
        <div className="space-y-1">
          {data?.docs.map((d) => (
            <div
              key={d.id}
              className={`group flex items-center gap-1 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-accent ${activeId === d.id ? "bg-accent" : ""}`}
              onClick={() => selectDoc(d.id)}
            >
              <span className="flex-1 truncate">{d.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); removeDoc(d.id); }}
                className="opacity-0 group-hover:opacity-100 text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="space-y-2">
        <Input
          value={title}
          onChange={(e) => { setTitle(e.target.value); scheduleSave(e.target.value, body); }}
          placeholder="Note title"
          className="text-base font-medium"
        />
        <Textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); scheduleSave(title, e.target.value); }}
          placeholder="Start writing… Saves automatically."
          rows={20}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {dirty ? "Saving…" : "Saved"}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// TASKS
// ============================================================================

function TasksTool({ workId }: { workId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listWorkTasks);
  const addFn = useServerFn(addWorkTask);
  const toggleFn = useServerFn(toggleWorkTask);
  const deleteFn = useServerFn(deleteWorkTask);
  const { data } = useQuery({
    queryKey: ["work-tasks", workId],
    queryFn: () => listFn({ data: { workId } }),
  });
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    const ch = supabase
      .channel(`work-tasks-${workId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "work_tasks", filter: `work_id=eq.${workId}` }, () => {
        qc.invalidateQueries({ queryKey: ["work-tasks", workId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workId, qc]);

  async function add() {
    const t = newTitle.trim();
    if (!t) return;
    setNewTitle("");
    try {
      await addFn({ data: { workId, title: t } });
      qc.invalidateQueries({ queryKey: ["work-tasks", workId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Tasks</h2>
      <div className="flex gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="Add a task and press Enter"
        />
        <Button onClick={add}><Plus className="size-4" /></Button>
      </div>
      <div className="space-y-1">
        {data?.tasks.length === 0 && <Empty title="No tasks" body="Capture what needs to ship next." />}
        {data?.tasks.map((t) => (
          <Card key={t.id} className="p-2.5 flex items-center gap-2">
            <button
              onClick={async () => {
                await toggleFn({ data: { taskId: t.id, done: !t.done } });
                qc.invalidateQueries({ queryKey: ["work-tasks", workId] });
              }}
              className={`size-5 rounded border flex items-center justify-center shrink-0 ${t.done ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}
            >
              {t.done && <Check className="size-3.5" />}
            </button>
            <span className={`flex-1 text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}>
              {t.title}
            </span>
            <button
              onClick={async () => {
                await deleteFn({ data: { taskId: t.id } });
                qc.invalidateQueries({ queryKey: ["work-tasks", workId] });
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="size-4" />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// LINKS
// ============================================================================

function LinksTool({ workId }: { workId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listWorkLinks);
  const addFn = useServerFn(addWorkLink);
  const deleteFn = useServerFn(deleteWorkLink);
  const { data } = useQuery({
    queryKey: ["work-links", workId],
    queryFn: () => listFn({ data: { workId } }),
  });
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<"reference" | "repo" | "demo" | "brief" | "asset" | "other">("reference");

  async function add() {
    if (!url.trim()) return;
    try {
      await addFn({ data: { workId, url: url.trim(), label: label.trim() || null, category } });
      setUrl(""); setLabel("");
      qc.invalidateQueries({ queryKey: ["work-links", workId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Links</h2>
      <Card className="p-3 space-y-2">
        <Input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <div className="flex gap-2">
          <Input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} className="flex-1" />
          <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reference">Reference</SelectItem>
              <SelectItem value="repo">Repo</SelectItem>
              <SelectItem value="demo">Demo</SelectItem>
              <SelectItem value="brief">Brief</SelectItem>
              <SelectItem value="asset">Asset</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={add}><Plus className="size-4" /></Button>
        </div>
      </Card>
      <div className="space-y-1">
        {data?.links.length === 0 && <Empty title="No links" body="Pin the repo, brief, references, demo URL — anything." />}
        {data?.links.map((l) => (
          <Card key={l.id} className="p-2.5 flex items-center gap-2">
            <LinkIcon className="size-4 text-muted-foreground shrink-0" />
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-sm truncate hover:underline">
              {l.label ?? l.url}
            </a>
            <Badge variant="outline" className="text-xs capitalize">{l.category}</Badge>
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground">
              <ExternalLink className="size-3.5" />
            </a>
            <button
              onClick={async () => {
                await deleteFn({ data: { linkId: l.id } });
                qc.invalidateQueries({ queryKey: ["work-links", workId] });
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="size-4" />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// ACTIVITY
// ============================================================================

function ActivityTool({ workId }: { workId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listWorkActivity);
  const { data } = useQuery({
    queryKey: ["work-activity", workId],
    queryFn: () => listFn({ data: { workId } }),
  });
  useEffect(() => {
    const ch = supabase
      .channel(`work-activity-${workId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "work_activity", filter: `work_id=eq.${workId}` }, () => {
        qc.invalidateQueries({ queryKey: ["work-activity", workId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workId, qc]);

  function describe(e: { kind: string; payload: any }): string {
    switch (e.kind) {
      case "work_created": return `created this Work`;
      case "file_uploaded": return `uploaded ${e.payload?.name ?? "a file"}`;
      case "file_deleted": return `deleted ${e.payload?.name ?? "a file"}`;
      case "doc_created": return `created note "${e.payload?.title ?? "Untitled"}"`;
      case "joined_via_invite": return `joined via invite link`;
      case "application_approved": return `approved an application`;
      case "application_rejected": return `declined an application`;
      case "visibility_changed": return `set visibility to ${e.payload?.visibility}`;
      default: return e.kind;
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Activity</h2>
      {!data?.events.length ? (
        <Empty title="No activity yet" body="Every meaningful change shows up here." />
      ) : (
        <div className="space-y-2">
          {data.events.map((e: any) => (
            <Card key={e.id} className="p-3 flex items-center gap-3">
              <Avatar className="size-7">
                <AvatarImage src={e.profiles?.avatar_url ?? undefined} />
                <AvatarFallback>{(e.profiles?.display_name ?? "?")[0]}</AvatarFallback>
              </Avatar>
              <p className="text-sm flex-1">
                <span className="font-medium">{e.profiles?.display_name ?? "Someone"}</span>{" "}
                <span className="text-muted-foreground">{describe(e)}</span>
              </p>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RIGHTS
// ============================================================================

function RightsTool({
  workId, isOwner, agreement, collaborators, visibility, slug,
}: {
  workId: string;
  isOwner: boolean;
  agreement: any;
  collaborators: any[];
  visibility: string;
  slug: string;
}) {
  const qc = useQueryClient();
  const inviteFn = useServerFn(createWorkInviteToken);
  const visFn = useServerFn(setWorkVisibility);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  async function makeInvite() {
    try {
      const res = await inviteFn({ data: { workId, expiresInDays: 14 } });
      const url = `${window.location.origin}/works/invite/${res.token}`;
      setInviteUrl(url);
      navigator.clipboard.writeText(url);
      toast.success("Invite link copied — expires in 14 days");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function changeVisibility(v: "private" | "public" | "invite_only") {
    try {
      await visFn({ data: { workId, visibility: v } });
      qc.invalidateQueries({ queryKey: ["work-tools", slug] });
      toast.success("Visibility updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Rights & Splits</h2>

      <Card className="p-4 space-y-3">
        <div>
          <p className="text-xs uppercase text-muted-foreground mb-1">Visibility</p>
          {isOwner ? (
            <Select value={visibility} onValueChange={(v) => changeVisibility(v as any)}>
              <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private — collaborators only</SelectItem>
                <SelectItem value="public">Open to applicants</SelectItem>
                <SelectItem value="invite_only">Invite link only</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="secondary" className="capitalize">{visibility}</Badge>
          )}
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={makeInvite}>
              <Copy className="size-3.5 mr-1.5" /> Generate invite link
            </Button>
            {inviteUrl && (
              <code className="text-xs px-2 py-1 bg-muted rounded truncate max-w-md">{inviteUrl}</code>
            )}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <p className="text-xs uppercase text-muted-foreground mb-2">Current agreement</p>
        {!agreement ? (
          <p className="text-sm text-muted-foreground">No agreement on file.</p>
        ) : (
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">License:</span> <span className="font-medium">{agreement.license}</span>{agreement.license_custom && <span className="text-muted-foreground"> — {agreement.license_custom}</span>}</div>
            <div><span className="text-muted-foreground">Commercial use:</span> <span className="font-medium capitalize">{agreement.commercial_use}</span></div>
            {agreement.credit_template && <div><span className="text-muted-foreground">Credit:</span> <span className="font-medium">{agreement.credit_template}</span></div>}
            <div className="text-xs text-muted-foreground">Version {agreement.version} · signed by the owner</div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <p className="text-xs uppercase text-muted-foreground mb-2">Splits</p>
        <div className="space-y-2">
          {(agreement?.splits ?? []).map((s: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{s.name ?? s.role}</span>{" "}
                <span className="text-muted-foreground">— {s.role}</span>
              </div>
              <Badge variant="outline">{s.pct}%</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-xs uppercase text-muted-foreground mb-2">Collaborators</p>
        <div className="space-y-2">
          {collaborators.map((c: any) => (
            <div key={c.id} className="flex items-center gap-3 text-sm">
              <Avatar className="size-7">
                <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                <AvatarFallback>{(c.profiles?.display_name ?? "?")[0]}</AvatarFallback>
              </Avatar>
              <span className="flex-1">{c.profiles?.display_name ?? c.profiles?.username}</span>
              <Badge variant="outline" className="text-xs">{c.role}</Badge>
              <Badge variant="secondary" className="text-xs">{c.splits_pct}%</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
