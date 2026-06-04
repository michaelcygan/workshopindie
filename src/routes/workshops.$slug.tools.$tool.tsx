import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ListChecks,
  FolderOpen,
  FileText,
  Plus,
  Trash2,
  Check,
  Link as LinkIcon,
  ExternalLink,
  Loader2,
  Lock,
  Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SUPPORTED = ["tasks", "drive", "docs"] as const;
type Tool = (typeof SUPPORTED)[number];

export const Route = createFileRoute("/workshops/$slug/tools/$tool")({
  beforeLoad: ({ params }) => {
    if (!SUPPORTED.includes(params.tool as Tool)) throw notFound();
  },
  component: ToolPage,
  head: ({ params }) => ({
    meta: [
      { title: `${cap(params.tool)} — Workshop Studio` },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Workshop = {
  id: string;
  slug: string;
  title: string;
  host_user_id: string;
  archived_at: string | null;
};

function ToolPage() {
  const { slug, tool } = Route.useParams() as { slug: string; tool: Tool };
  const { user } = useAuth();

  const { data: ws, isLoading } = useQuery({
    queryKey: ["workshop-tool-ws", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("workshops")
        .select("id,slug,title,host_user_id,archived_at")
        .eq("slug", slug)
        .maybeSingle();
      return (data as Workshop | null) ?? null;
    },
  });

  const { data: membership } = useQuery({
    queryKey: ["ws-membership", ws?.id, user?.id],
    enabled: !!ws && !!user,
    queryFn: async () => {
      if (ws!.host_user_id === user!.id) return { isMember: true };
      const { data } = await supabase
        .from("workshop_participants")
        .select("id,participant_status")
        .eq("workshop_id", ws!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return {
        isMember:
          !!data &&
          ["confirmed", "checked_in", "completed"].includes(data.participant_status),
      };
    },
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-14">
        <div className="h-8 w-48 animate-pulse rounded bg-surface-2" />
      </main>
    );
  }
  if (!ws) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl">Workshop not found</h1>
      </main>
    );
  }
  if (ws.archived_at || !user || !membership?.isMember) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <Lock className="mx-auto h-8 w-8 text-ink-muted" />
        <h1 className="mt-3 font-display text-3xl text-ink">
          {ws.archived_at ? "Studio closed" : "Members only"}
        </h1>
        <Link to="/workshops/$slug" params={{ slug }} className="mt-6 inline-block">
          <Button variant="outline" className="rounded-full">
            Back to Workshop
          </Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 md:py-14">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <Link
          to="/workshops/$slug/tools"
          params={{ slug }}
          className="text-xs uppercase tracking-wide text-ink-muted hover:text-ink"
        >
          ← Studio Tools
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-ink">
            {tool === "tasks" && <ListChecks className="h-5 w-5" />}
            {tool === "drive" && <FolderOpen className="h-5 w-5" />}
            {tool === "docs" && <FileText className="h-5 w-5" />}
          </div>
          <h1 className="font-display text-4xl text-ink md:text-5xl">{cap(tool)}</h1>
        </div>
        <p className="mt-2 text-ink-soft">
          {tool === "tasks" && "Lightweight checklist to actually ship within the session."}
          {tool === "drive" && "Drop files and paste cloud links collaborators need."}
          {tool === "docs" && "Shared notes, scripts, treatments, lyrics."}
        </p>

        <div className="mt-8">
          {tool === "tasks" && <Tasks workshopId={ws.id} />}
          {tool === "drive" && <Drive workshopId={ws.id} />}
          {tool === "docs" && <Docs workshopId={ws.id} userId={user.id} />}
        </div>
      </motion.div>
    </main>
  );
}

/* --------------------------- Tasks --------------------------- */

type Task = {
  id: string;
  title: string;
  status: string;
  body: string | null;
  sort_order: number;
  completed_at: string | null;
  created_by: string | null;
};

function Tasks({ workshopId }: { workshopId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [draft, setDraft] = useState("");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["ws-tasks", workshopId],
    queryFn: async () => {
      const { data } = await supabase
        .from("workshop_tasks")
        .select("id,title,status,body,sort_order,completed_at,created_by")
        .eq("workshop_id", workshopId)
        .order("status", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      return (data as Task[]) ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`ws-tasks-${workshopId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workshop_tasks",
          filter: `workshop_id=eq.${workshopId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["ws-tasks", workshopId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [workshopId, qc]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title || !user) return;
    setDraft("");
    const nextOrder = (tasks[tasks.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase.from("workshop_tasks").insert({
      workshop_id: workshopId,
      title,
      created_by: user.id,
      sort_order: nextOrder,
    });
    if (error) toast.error(error.message);
  }

  async function toggle(t: Task) {
    const done = t.status === "done";
    const { error } = await supabase
      .from("workshop_tasks")
      .update({
        status: done ? "open" : "done",
        completed_at: done ? null : new Date().toISOString(),
      })
      .eq("id", t.id);
    if (error) toast.error(error.message);
  }

  async function remove(id: string) {
    const { error } = await supabase.from("workshop_tasks").delete().eq("id", id);
    if (error) toast.error(error.message);
  }

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div>
      <form onSubmit={add} className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What needs to happen next?"
          maxLength={200}
        />
        <Button type="submit" size="icon" className="rounded-full" disabled={!draft.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      {isLoading ? (
        <div className="mt-6 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-ink-muted" />
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-1.5">
            {open.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-ink-muted">
                No open tasks. Add one to start shipping.
              </li>
            )}
            {open.map((t) => (
              <TaskRow key={t.id} t={t} onToggle={() => toggle(t)} onRemove={() => remove(t.id)} />
            ))}
          </ul>
          {done.length > 0 && (
            <>
              <h3 className="mt-8 mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                Done · {done.length}
              </h3>
              <ul className="space-y-1.5">
                {done.map((t) => (
                  <TaskRow
                    key={t.id}
                    t={t}
                    onToggle={() => toggle(t)}
                    onRemove={() => remove(t.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

function TaskRow({
  t,
  onToggle,
  onRemove,
}: {
  t: Task;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const done = t.status === "done";
  return (
    <li className="group flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5">
      <button
        onClick={onToggle}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
          done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border hover:border-primary",
        )}
        aria-label={done ? "Mark as open" : "Mark as done"}
      >
        {done && <Check className="h-3 w-3" />}
      </button>
      <span
        className={cn(
          "flex-1 text-sm",
          done ? "text-ink-muted line-through" : "text-ink",
        )}
      >
        {t.title}
      </span>
      <button
        onClick={onRemove}
        className="opacity-0 transition group-hover:opacity-100 text-ink-muted hover:text-destructive"
        aria-label="Delete task"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

/* --------------------------- Drive (links only for v1) --------------------------- */

type DriveLink = {
  id: string;
  url: string;
  title: string | null;
  provider: string;
  note: string | null;
  added_by: string | null;
  created_at: string;
};

function detectProvider(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host.includes("drive.google.com") || host.includes("docs.google.com")) return "google";
    if (host.includes("dropbox.com")) return "dropbox";
    if (host.includes("figma.com")) return "figma";
    if (host.includes("notion.so") || host.includes("notion.site")) return "notion";
    if (host.includes("github.com")) return "github";
    if (host.includes("vimeo.com")) return "vimeo";
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    if (host.includes("soundcloud.com")) return "soundcloud";
    return "other";
  } catch {
    return "other";
  }
}

function Drive({ workshopId }: { workshopId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["ws-drive-links", workshopId],
    queryFn: async () => {
      const { data } = await supabase
        .from("workshop_drive_links")
        .select("id,url,title,provider,note,added_by,created_at")
        .eq("workshop_id", workshopId)
        .order("created_at", { ascending: false });
      return (data as DriveLink[]) ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`ws-drive-${workshopId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workshop_drive_links",
          filter: `workshop_id=eq.${workshopId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["ws-drive-links", workshopId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [workshopId, qc]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !url.trim()) return;
    try {
      new URL(url.trim());
    } catch {
      return toast.error("That URL doesn't look right.");
    }
    setAdding(true);
    const { error } = await supabase.from("workshop_drive_links").insert({
      workshop_id: workshopId,
      added_by: user.id,
      url: url.trim(),
      title: title.trim() || null,
      provider: detectProvider(url.trim()),
    });
    setAdding(false);
    if (error) return toast.error(error.message);
    setUrl("");
    setTitle("");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("workshop_drive_links").delete().eq("id", id);
    if (error) toast.error(error.message);
  }

  return (
    <div>
      <form
        onSubmit={add}
        className="grid gap-2 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a link (Drive, Figma, Notion, GitHub…)"
          type="url"
        />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Optional label"
          maxLength={120}
        />
        <Button type="submit" className="rounded-full gap-2" disabled={!url.trim() || adding}>
          <LinkIcon className="h-4 w-4" />
          {adding ? "Adding…" : "Add"}
        </Button>
      </form>

      <p className="mt-3 text-xs text-ink-muted">
        Direct file uploads ship next. For now, paste cloud links — they're cleaner anyway.
      </p>

      {isLoading ? (
        <div className="mt-6 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-ink-muted" />
        </div>
      ) : links.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-ink-muted">
          Nothing dropped yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {links.map((l) => (
            <li
              key={l.id}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5"
            >
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
                {l.provider}
              </span>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer noopener"
                className="min-w-0 flex-1 truncate text-sm text-ink hover:underline"
              >
                {l.title || l.url}
              </a>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-ink-muted hover:text-ink"
                aria-label="Open"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              {user?.id === l.added_by && (
                <button
                  onClick={() => remove(l.id)}
                  className="opacity-0 transition group-hover:opacity-100 text-ink-muted hover:text-destructive"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --------------------------- Docs --------------------------- */

type Doc = {
  id: string;
  title: string;
  content_md: string;
  sort_order: number;
  updated_at: string;
};

function Docs({ workshopId, userId }: { workshopId: string; userId: string }) {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["ws-docs", workshopId],
    queryFn: async () => {
      const { data } = await supabase
        .from("workshop_docs")
        .select("id,title,content_md,sort_order,updated_at")
        .eq("workshop_id", workshopId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      return (data as Doc[]) ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`ws-docs-${workshopId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workshop_docs",
          filter: `workshop_id=eq.${workshopId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["ws-docs", workshopId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [workshopId, qc]);

  const active = useMemo(
    () => docs.find((d) => d.id === activeId) ?? docs[0] ?? null,
    [docs, activeId],
  );

  async function addDoc() {
    const nextOrder = (docs[docs.length - 1]?.sort_order ?? 0) + 1;
    const { data, error } = await supabase
      .from("workshop_docs")
      .insert({
        workshop_id: workshopId,
        created_by: userId,
        title: "Untitled",
        content_md: "",
        sort_order: nextOrder,
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    setActiveId(data.id);
  }

  async function removeDoc(id: string) {
    if (!confirm("Delete this doc?")) return;
    const { error } = await supabase.from("workshop_docs").delete().eq("id", id);
    if (error) toast.error(error.message);
    if (id === activeId) setActiveId(null);
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

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <aside className="rounded-2xl border border-border bg-surface p-2">
        <ul className="space-y-0.5">
          {docs.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => setActiveId(d.id)}
                className={cn(
                  "w-full truncate rounded-xl px-3 py-2 text-left text-sm transition",
                  (active?.id ?? "") === d.id
                    ? "bg-muted text-ink"
                    : "text-ink-soft hover:bg-muted/50",
                )}
              >
                {d.title || "Untitled"}
              </button>
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

      {active && <DocEditor key={active.id} doc={active} onDelete={() => removeDoc(active.id)} />}
    </div>
  );
}

function DocEditor({ doc, onDelete }: { doc: Doc; onDelete: () => void }) {
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.content_md);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Reset on doc switch
  useEffect(() => {
    setTitle(doc.title);
    setBody(doc.content_md);
    setDirty(false);
  }, [doc.id, doc.title, doc.content_md]);

  // Debounced autosave
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(save, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, dirty]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("workshop_docs")
      .update({ title: title.trim() || "Untitled", content_md: body })
      .eq("id", doc.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setDirty(false);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          className="border-none bg-transparent px-0 text-lg font-display focus-visible:ring-0"
          placeholder="Untitled"
          maxLength={200}
        />
        <span className="text-xs text-ink-muted">
          {saving ? "Saving…" : dirty ? "Unsaved" : "Saved"}
        </span>
        <Button
          onClick={save}
          size="sm"
          variant="ghost"
          className="rounded-full"
          disabled={!dirty || saving}
        >
          <Save className="h-3.5 w-3.5" />
        </Button>
        <Button
          onClick={onDelete}
          size="sm"
          variant="ghost"
          className="rounded-full text-ink-muted hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setDirty(true);
        }}
        rows={18}
        placeholder="Start writing. Markdown is fine."
        className="mt-3 resize-y border-none bg-transparent px-0 focus-visible:ring-0"
      />
    </div>
  );
}
