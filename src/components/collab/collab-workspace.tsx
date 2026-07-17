import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Link2, Video, Send, Users, Pencil, X, ExternalLink, Trash2 } from "lucide-react";
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
} from "@/lib/collab-workspace.functions";
import { listCollabMembers } from "@/lib/collab.functions";

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
  const [tab, setTab] = useState<"chat" | "links">("chat");

  const membersFn = useServerFn(listCollabMembers);
  const listFn = useServerFn(listCollabMessages);
  const postFn = useServerFn(postCollabMessage);
  const delFn = useServerFn(deleteCollabMessage);
  const getSettingsFn = useServerFn(getCollabWorkspaceSettings);
  const setMeetingFn = useServerFn(setCollabMeetingUrl);

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

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface">
      {/* Compact header */}
      <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-primary/10 px-2 text-[11px] font-medium text-primary">
            <Users className="h-3 w-3" /> Collaborating
          </span>
          <div className="flex -space-x-2">
            {members.slice(0, 5).map((m) => (
              <Avatar key={m.id} className="h-6 w-6 ring-2 ring-surface">
                <AvatarImage src={m.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">{(m.display_name ?? m.username ?? "?").slice(0, 1)}</AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="text-xs text-ink-muted">{members.length} member{members.length === 1 ? "" : "s"}</span>
        </div>
        <div className="sm:ml-auto flex items-center gap-2">
          <MeetingControl
            meetingUrl={meetingUrl}
            isOwner={isOwner}
            onSave={(u) =>
              setMeetingFn({ data: { collabPostId, meetingUrl: u } }).then(
                () => qc.invalidateQueries({ queryKey: ["collab-workspace-settings", collabPostId] }),
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
          aria-selected={tab === "links"}
          onClick={() => setTab("links")}
          className={cn(
            "flex-1 min-h-[44px] px-4 py-2 text-sm font-medium transition",
            tab === "links" ? "bg-surface text-ink border-b-2 border-primary" : "text-ink-muted hover:text-ink",
          )}
        >
          <Link2 className="mr-1.5 inline h-4 w-4" /> Links
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
            <Button type="submit" size="sm" className="min-h-[44px] rounded-full gap-1" disabled={!body.trim() || send.isPending}>
              <Send className="h-4 w-4" /> Send
            </Button>
          </form>
        </div>
      ) : (
        <LoungeLinks
          messages={messages.map((m) => ({ id: m.id, user_id: m.author_id, body: m.body, created_at: m.created_at }))}
          profileLookup={profileLookup}
        />
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
        <Button asChild size="sm" className="rounded-full gap-1.5">
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
        <Button size="sm" className="rounded-full" disabled={saving} onClick={() => commit(value.trim() ? value.trim() : null)}>
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
      <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => setEditing(true)}>
        <ExternalLink className="h-4 w-4" /> Add meeting link
      </Button>
    );
  }

  return null;
}
