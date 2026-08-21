import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Video, Send, Users, Pencil, X, ExternalLink, Trash2, ListTodo, FolderOpen, CalendarClock, UserMinus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { LoungeLinks } from "@/components/lounge-links";
import type { ProfileLite } from "@/components/media-panel";
import { RenderLinks } from "@/lib/render-links";
import {
  listCollabMessages,
  postCollabMessage,
  deleteCollabMessage,
  getCollabWorkspaceSettings,
  setCollabMeetingUrl,
  setCollabFilesUrl,
  setCollabNextMeetingAt,
} from "@/lib/collab-workspace.functions";
import { listCollabMembers, removeCollabMember } from "@/lib/collab.functions";
import { CollabTasks, useCollabTaskCount } from "@/components/collab/collab-tasks";

type Msg = {
  id: string;
  collab_post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

const MAX_LEN = 2000;

function meetingCta(url: string | null | undefined): string {
  if (!url) return "Join meeting";
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (host.includes("zoom.us")) return "Join Zoom";
    if (host.includes("meet.google.com")) return "Join Google Meet";
    if (host.includes("teams.microsoft.com") || host.includes("teams.live.com")) return "Join Teams";
    if (host.includes("discord.")) return "Join Discord";
    if (host.includes("whereby.com")) return "Join Whereby";
    if (host.includes("jit.si") || host.includes("meet.jit.si")) return "Join Jitsi";
    return "Join meeting";
  } catch {
    return "Join meeting";
  }
}

export function CollabWorkspace({
  collabPostId,
  ownerId,
  isOwner,
}: {
  collabPostId: string;
  ownerId: string;
  isOwner: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"chat" | "tasks" | "files">("chat");
  const taskCount = useCollabTaskCount(collabPostId);

  const membersFn = useServerFn(listCollabMembers);
  const listFn = useServerFn(listCollabMessages);
  const postFn = useServerFn(postCollabMessage);
  const delFn = useServerFn(deleteCollabMessage);
  const getSettingsFn = useServerFn(getCollabWorkspaceSettings);
  const setMeetingFn = useServerFn(setCollabMeetingUrl);
  const setFilesFn = useServerFn(setCollabFilesUrl);
  const setNextMeetingFn = useServerFn(setCollabNextMeetingAt);

  const membersQ = useQuery({
    queryKey: ["collab-members", collabPostId],
    queryFn: () => membersFn({ data: { collabPostId } }),
  });

  const messagesQ = useQuery({
    queryKey: ["collab-messages", collabPostId],
    queryFn: () => listFn({ data: { collabPostId } }) as Promise<Msg[]>,
    staleTime: 10_000,
  });

  const settingsQ = useQuery({
    queryKey: ["collab-workspace-settings", collabPostId],
    queryFn: () => getSettingsFn({ data: { collabPostId } }),
  });

  // Realtime: refetch on any insert/delete for this collab.
  useEffect(() => {
    const suffix = Math.random().toString(36).slice(2);
    const ch = supabase
      .channel(`collab-msgs-${collabPostId}-${suffix}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collab_messages", filter: `collab_post_id=eq.${collabPostId}` },
        () => qc.invalidateQueries({ queryKey: ["collab-messages", collabPostId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [collabPostId, qc]);

  const messages: Msg[] = messagesQ.data ?? [];

  const profileLookup = useMemo(() => {
    const m = new Map<string, ProfileLite>();
    for (const msg of messages) {
      if (msg.author) {
        m.set(msg.author_id, {
          user_id: msg.author_id,
          display_name: msg.author.display_name,
          username: msg.author.username,
          avatar_url: msg.author.avatar_url,
        });
      }
    }
    for (const p of membersQ.data?.members ?? []) {
      if (!m.has(p.id)) {
        m.set(p.id, {
          user_id: p.id,
          display_name: p.display_name,
          username: p.username,
          avatar_url: p.avatar_url,
        });
      }
    }
    return m;
  }, [messages, membersQ.data]);

  const [body, setBody] = useState("");
  const send = useMutation({
    mutationFn: (b: string) => postFn({ data: { collabPostId, body: b } }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["collab-messages", collabPostId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (messageId: string) => delFn({ data: { messageId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collab-messages", collabPostId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-scroll to bottom on new message.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    send.mutate(trimmed);
  }

  const members = membersQ.data?.members ?? [];
  const meetingUrl = settingsQ.data?.meeting_url ?? null;
  const filesUrl = settingsQ.data?.files_url ?? null;
  const nextMeetingAt = settingsQ.data?.next_meeting_at ?? null;

  const invalidateSettings = () =>
    qc.invalidateQueries({ queryKey: ["collab-workspace-settings", collabPostId] });

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
      {/* Compact header */}
      <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:gap-4">
        <TeamPopover
          collabPostId={collabPostId}
          members={members}
          isOwner={isOwner}
          onRemoved={() => {
            qc.invalidateQueries({ queryKey: ["collab-members", collabPostId] });
          }}
        />
        <div className="sm:ml-auto flex flex-wrap items-center gap-2">
          <NextMeetingControl
            nextMeetingAt={nextMeetingAt}
            isOwner={isOwner}
            onSave={(iso) =>
              setNextMeetingFn({ data: { collabPostId, nextMeetingAt: iso } }).then(
                invalidateSettings,
                (e: Error) => toast.error(e.message),
              )
            }
          />
          <MeetingControl
            meetingUrl={meetingUrl}
            isOwner={isOwner}
            onSave={(u) =>
              setMeetingFn({ data: { collabPostId, meetingUrl: u } }).then(
                () => invalidateSettings(),
                (e) => toast.error(e.message),
              )
            }
          />
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex border-b border-border">
        <button
          role="tab"
          aria-selected={tab === "chat"}
          onClick={() => setTab("chat")}
          className={cn(
            "flex-1 min-h-[44px] px-4 py-2 text-sm font-medium transition",
            tab === "chat" ? "bg-surface text-ink border-b-2 border-primary" : "text-ink-muted hover:text-ink",
          )}
        >
          <MessageCircle className="mr-1.5 inline h-4 w-4" /> Chat
        </button>
        <button
          role="tab"
          aria-selected={tab === "tasks"}
          onClick={() => setTab("tasks")}
          className={cn(
            "flex-1 min-h-[44px] px-4 py-2 text-sm font-medium transition",
            tab === "tasks" ? "bg-surface text-ink border-b-2 border-primary" : "text-ink-muted hover:text-ink",
          )}
        >
          <ListTodo className="mr-1.5 inline h-4 w-4" /> Tasks
          {taskCount.incomplete > 0 && (
            <span className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary tabular-nums">
              {taskCount.incomplete}
            </span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={tab === "files"}
          onClick={() => setTab("files")}
          className={cn(
            "flex-1 min-h-[44px] px-4 py-2 text-sm font-medium transition",
            tab === "files" ? "bg-surface text-ink border-b-2 border-primary" : "text-ink-muted hover:text-ink",
          )}
        >
          <FolderOpen className="mr-1.5 inline h-4 w-4" /> Files
        </button>
      </div>


      {tab === "chat" ? (
        <div className="flex flex-col">
          <div
            ref={scrollRef}
            className="h-[clamp(280px,40vh,480px)] overflow-y-auto p-3 sm:p-4"
          >
            {messagesQ.isLoading ? (
              <div className="h-24 animate-pulse rounded-2xl bg-muted/40" />
            ) : messages.length === 0 ? (
              <p className="mt-6 text-center text-sm text-ink-muted">
                Say hi — this chat is just for you and your collaborators.
              </p>
            ) : (
              <ul className="space-y-3">
                {messages.map((m) => {
                  const mine = user?.id === m.author_id;
                  const canDelete = mine || isOwner;
                  return (
                    <li key={m.id} className="flex gap-2.5">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={m.author?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {(m.author?.display_name ?? m.author?.username ?? "?").slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-ink truncate">
                            {m.author?.display_name || m.author?.username || "Member"}
                          </span>
                          <span className="text-[11px] text-ink-muted">
                            {new Date(m.created_at).toLocaleString(undefined, {
                              month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                            })}
                          </span>
                          {canDelete && (
                            <button
                              onClick={() => del.mutate(m.id)}
                              className="ml-auto text-ink-muted hover:text-destructive"
                              aria-label="Delete message"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm text-ink-soft">
                          <RenderLinks text={m.body} />
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <form onSubmit={submit} className="flex items-end gap-2 border-t border-border p-2 sm:p-3">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_LEN))}
              placeholder="Message your collaborators…"
              rows={1}
              className="min-h-[44px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(e);
                }
              }}
            />
            <Button type="submit" size="sm" className="min-h-[44px] rounded-md gap-1" disabled={!body.trim() || send.isPending}>
              <Send className="h-4 w-4" /> Send
            </Button>
          </form>
        </div>
      ) : tab === "tasks" ? (
        <CollabTasks collabPostId={collabPostId} ownerId={ownerId} isOwner={isOwner} />
      ) : (
        <div className="p-3 sm:p-4">
          <ProjectFolderRow
            filesUrl={filesUrl}
            isOwner={isOwner}
            onSave={(u) =>
              setFilesFn({ data: { collabPostId, filesUrl: u } }).then(
                () => invalidateSettings(),
                (e: Error) => toast.error(e.message),
              )
            }
          />
          {messages.length > 0 ? (
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Shared links</p>
              <LoungeLinks
                messages={messages.map((m) => ({ id: m.id, user_id: m.author_id, body: m.body, created_at: m.created_at }))}
                profileLookup={profileLookup}
              />
            </div>
          ) : !filesUrl && !isOwner ? (
            <p className="mt-4 text-sm text-ink-muted">No files or shared links yet.</p>
          ) : null}
        </div>
      )}
    </section>
  );
}


function MeetingControl({
  meetingUrl,
  isOwner,
  onSave,
}: {
  meetingUrl: string | null;
  isOwner: boolean;
  onSave: (url: string | null) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(meetingUrl ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(meetingUrl ?? "");
  }, [meetingUrl]);

  async function commit(next: string | null) {
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (meetingUrl && !editing) {
    return (
      <div className="flex items-center gap-1">
        <Button asChild size="sm" className="rounded-md gap-1.5">
          <a href={meetingUrl} target="_blank" rel="noopener noreferrer">
            <Video className="h-4 w-4" /> {meetingCta(meetingUrl)}
          </a>
        </Button>
        {isOwner && (
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setEditing(true)} aria-label="Edit meeting link">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  if (!isOwner) return null;

  if (editing || !meetingUrl) {
    return editing ? (
      <div className="flex w-full items-center gap-1.5 sm:w-auto">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://zoom.us/j/…"
          className="h-9 flex-1 sm:w-64"
        />
        <Button size="sm" className="rounded-md" disabled={saving} onClick={() => commit(value.trim() ? value.trim() : null)}>
          Save
        </Button>
        {meetingUrl && (
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => commit(null)} aria-label="Remove">
            <X className="h-4 w-4" />
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setValue(meetingUrl ?? ""); setEditing(false); }} aria-label="Cancel">
          <X className="h-4 w-4" />
        </Button>
      </div>
    ) : (
      <Button size="sm" variant="outline" className="rounded-md gap-1.5" onClick={() => setEditing(true)}>
        <ExternalLink className="h-4 w-4" /> Add meeting link
      </Button>
    );
  }

  return null;
}

/* ─── Team ──────────────────────────────────────────────────────────── */

type TeamMember = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_owner?: boolean;
  role_name?: string | null;
};

function TeamPopover({
  collabPostId,
  members,
  isOwner,
  onRemoved,
}: {
  collabPostId: string;
  members: TeamMember[];
  isOwner: boolean;
  onRemoved: () => void;
}) {
  const removeFn = useServerFn(removeCollabMember);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ordered = [...members].sort((a, b) => Number(!!b.is_owner) - Number(!!a.is_owner));

  async function remove(m: TeamMember) {
    const name = m.display_name || m.username || "This collaborator";
    if (
      !confirm(
        `Remove ${name} from this Collab?\n\nThey will lose access to the private chat, tasks, files and meeting details. External services like Google Drive are not affected.`,
      )
    )
      return;
    setBusyId(m.id);
    try {
      await removeFn({ data: { collabPostId, memberUserId: m.id } });
      toast.success(`${name} was removed.`);
      onRemoved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove them.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-h-[36px] items-center gap-2 rounded-full px-1.5 text-left transition hover:bg-surface-2"
          aria-label="View team"
        >
          <div className="flex -space-x-2">
            {ordered.slice(0, 5).map((m) => (
              <Avatar key={m.id} className="h-6 w-6 ring-2 ring-surface">
                <AvatarImage src={m.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {(m.display_name ?? m.username ?? "?").slice(0, 1)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
            <Users className="h-3.5 w-3.5" />
            {members.length} member{members.length === 1 ? "" : "s"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <ul className="space-y-1">
          {ordered.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-surface-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={m.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {(m.display_name ?? m.username ?? "?").slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                {m.username ? (
                  <Link
                    to="/$username"
                    params={{ username: m.username }}
                    className="block truncate text-sm font-medium text-ink hover:underline"
                  >
                    {m.display_name || m.username}
                  </Link>
                ) : (
                  <span className="block truncate text-sm font-medium text-ink">
                    {m.display_name || "Member"}
                  </span>
                )}
                <span className="text-[11px] text-ink-muted">
                  {m.is_owner ? "Owner" : m.role_name || "Collaborator"}
                </span>
              </div>
              {isOwner && !m.is_owner && (
                <button
                  type="button"
                  onClick={() => remove(m)}
                  disabled={busyId === m.id}
                  className="text-ink-muted transition hover:text-destructive disabled:opacity-50"
                  aria-label={`Remove ${m.display_name || m.username || "collaborator"} from this Collab`}
                  title="Remove from Collab"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Next meeting ──────────────────────────────────────────────────── */

function formatMeetingTime(iso: string): string {
  const d = new Date(iso);
  const stamp = d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const zone =
    new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  return zone ? `${stamp} ${zone}` : stamp;
}

/** `datetime-local` value in the viewer's own zone. */
function toLocalInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 86400000);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function NextMeetingControl({
  nextMeetingAt,
  isOwner,
  onSave,
}: {
  nextMeetingAt: string | null;
  isOwner: boolean;
  onSave: (iso: string | null) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => toLocalInput(nextMeetingAt));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(toLocalInput(nextMeetingAt));
  }, [nextMeetingAt]);

  const upcoming = nextMeetingAt && new Date(nextMeetingAt).getTime() > Date.now() ? nextMeetingAt : null;

  async function commit(next: string | null) {
    setSaving(true);
    try {
      await onSave(next);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const label = upcoming
    ? formatMeetingTime(upcoming)
    : nextMeetingAt
      ? "Schedule next meeting"
      : "Schedule meeting";

  if (!isOwner) {
    if (!upcoming) return null;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
        <CalendarClock className="h-3.5 w-3.5" /> {label}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="rounded-md gap-1.5 text-ink-soft">
          <CalendarClock className="h-3.5 w-3.5" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <label className="text-xs font-medium text-ink" htmlFor="collab-next-meeting">
          Next meeting
        </label>
        <Input
          id="collab-next-meeting"
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1.5 h-9"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" className="rounded-md" disabled={saving} onClick={() => commit(value ? new Date(value).toISOString() : null)}>
            Save
          </Button>
          {nextMeetingAt && (
            <Button size="sm" variant="ghost" className="rounded-md text-ink-muted" disabled={saving} onClick={() => commit(null)}>
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Project folder ────────────────────────────────────────────────── */

function folderCta(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("google.com")) return "Open Drive";
  } catch {
    /* fall through */
  }
  return "Open files";
}

function ProjectFolderRow({
  filesUrl,
  isOwner,
  onSave,
}: {
  filesUrl: string | null;
  isOwner: boolean;
  onSave: (url: string | null) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(filesUrl ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(filesUrl ?? "");
  }, [filesUrl]);

  async function commit(next: string | null) {
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://drive.google.com/…"
          className="h-9 flex-1 min-w-[12rem]"
        />
        <Button size="sm" className="rounded-md" disabled={saving} onClick={() => commit(value.trim() || null)}>
          Save
        </Button>
        {filesUrl && (
          <Button size="sm" variant="ghost" className="rounded-md text-ink-muted" disabled={saving} onClick={() => commit(null)}>
            Remove
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setValue(filesUrl ?? ""); setEditing(false); }} aria-label="Cancel">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (!filesUrl) {
    if (!isOwner) return null;
    return (
      <Button size="sm" variant="outline" className="rounded-md gap-1.5" onClick={() => setEditing(true)}>
        <FolderOpen className="h-4 w-4" /> Add project folder
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <FolderOpen className="h-4 w-4 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">Project folder</p>
        <p className="truncate text-[11px] text-ink-muted">{filesUrl}</p>
      </div>
      <Button asChild size="sm" className="rounded-md gap-1.5 shrink-0">
        <a href={filesUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" /> {folderCta(filesUrl)}
        </a>
      </Button>
      {isOwner && (
        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setEditing(true)} aria-label="Edit project folder">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
