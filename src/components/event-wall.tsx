import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, Sparkles } from "lucide-react";
import {
  listEventComments,
  postEventComment,
  toggleEventCommentLike,
} from "@/lib/group-events.functions";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  ChatMentionInput,
  MessageBody,
  type MentionCandidate,
} from "@/components/chat-mention-input";
import { cn } from "@/lib/utils";

type EventWallProps = {
  eventId: string;
  canPost: boolean;
  sealed?: boolean;
  participants?: MentionCandidate[];
};

export function EventWall({ eventId, canPost, sealed = false, participants = [] }: EventWallProps) {
  const { user } = useAuth();
  const list = useServerFn(listEventComments);
  const post = useServerFn(postEventComment);
  const toggleLike = useServerFn(toggleEventCommentLike);
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const { data } = useQuery({
    queryKey: ["event-comments", eventId, user?.id ?? null],
    enabled: !!user,
    queryFn: () => list({ data: { event_id: eventId } }),
    staleTime: 15_000,
  });

  async function submit() {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await post({ data: { event_id: eventId, body: draft.trim() } });
      setDraft("");
      qc.invalidateQueries({ queryKey: ["event-comments", eventId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function onLike(commentId: string) {
    if (!user || sealed) return;
    try {
      await toggleLike({ data: { comment_id: commentId } });
      qc.invalidateQueries({ queryKey: ["event-comments", eventId] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const composerEnabled = !!user && canPost && !sealed;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg text-ink">Wall</h3>
        {sealed && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
            Sealed
          </span>
        )}
      </div>
      {!user ? (
        <p className="mb-4 rounded-2xl bg-muted px-3 py-2 text-xs text-ink-muted">
          <Link to="/login" className="text-primary underline">Sign in</Link> & RSVP to join the conversation.
        </p>
      ) : sealed ? (
        <p className="mb-4 rounded-2xl bg-muted px-3 py-2 text-xs text-ink-muted">
          This wall is sealed. Thanks for showing up.
        </p>
      ) : composerEnabled ? (
        <div className="mb-4">
          <ChatMentionInput
            draft={draft}
            setDraft={setDraft}
            onSubmit={submit}
            sending={sending}
            placeholder="Say hi, tag a friend, share a track…"
            participants={participants}
            disabled={sending}
          />
        </div>
      ) : (
        <p className="mb-4 rounded-2xl bg-muted px-3 py-2 text-xs text-ink-muted">
          RSVP Going to post on the wall.
        </p>
      )}

      <div className="space-y-3">
        {(data ?? []).length === 0 && (
          <p className="text-sm text-ink-muted">No posts yet. Be first.</p>
        )}
        {(data ?? []).map((c) => {
          const row = c as unknown as {
            id: string;
            body: string;
            created_at: string;
            system_kind: string | null;
            like_count: number;
            liked_by_me: boolean;
            author: {
              id: string;
              username: string | null;
              display_name: string | null;
              avatar_url: string | null;
            } | null;
          };
          if (row.system_kind) {
            return (
              <div key={row.id} className="flex items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 text-xs text-ink-muted">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{row.body}</span>
                <span className="ml-auto text-[10px]">
                  {new Date(row.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
            );
          }
          const author = row.author;
          return (
            <div key={row.id} className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={author?.avatar_url ?? undefined} />
                <AvatarFallback>{(author?.display_name ?? "?").slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  {author?.username ? (
                    <Link to="/u/$username" params={{ username: author.username }} className="text-sm font-medium text-ink hover:underline">
                      {author.display_name ?? author.username}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-ink">{author?.display_name ?? "Someone"}</span>
                  )}
                  <span className="text-[11px] text-ink-muted">
                    {new Date(row.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                <div className="text-sm text-ink-soft">
                  <MessageBody body={row.body} participants={participants} meUsername={null} />
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn(
                      "h-6 gap-1 rounded-full px-2 text-[11px]",
                      row.liked_by_me ? "text-rose-500" : "text-ink-muted",
                    )}
                    onClick={() => onLike(row.id)}
                    disabled={sealed || !user}
                    aria-label={row.liked_by_me ? "Unlike" : "Like"}
                  >
                    <Heart className={cn("h-3.5 w-3.5", row.liked_by_me && "fill-current")} />
                    {row.like_count > 0 && <span>{row.like_count}</span>}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
