import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { listEventComments, postEventComment } from "@/lib/group-events.functions";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export function EventWall({ eventId, canPost }: { eventId: string; canPost: boolean }) {
  const { user } = useAuth();
  const list = useServerFn(listEventComments);
  const post = useServerFn(postEventComment);
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const { data } = useQuery({
    queryKey: ["event-comments", eventId],
    queryFn: () => list({ data: { event_id: eventId } }),
    staleTime: 15_000,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await post({ data: { event_id: eventId, body: body.trim() } });
      setBody("");
      qc.invalidateQueries({ queryKey: ["event-comments", eventId] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section>
      <h3 className="mb-3 font-display text-lg text-ink">Wall</h3>
      {user && canPost ? (
        <form onSubmit={submit} className="mb-4 flex flex-col gap-2">
          <Textarea
            placeholder="Say hi, share a track, post a question…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={2}
            className="resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-muted">{body.length}/500</span>
            <Button type="submit" size="sm" className="rounded-full" disabled={!body.trim()}>
              Post
            </Button>
          </div>
        </form>
      ) : (
        <p className="mb-4 rounded-2xl bg-muted px-3 py-2 text-xs text-ink-muted">
          {user ? "RSVP Going to post on the wall." : "Sign in & RSVP to join the conversation."}
        </p>
      )}
      <div className="space-y-3">
        {(data ?? []).length === 0 && <p className="text-sm text-ink-muted">No posts yet. Be first.</p>}
        {(data ?? []).map((c) => {
          const author = (c as unknown as { author: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null }).author;
          return (
            <div key={c.id} className="flex gap-3">
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
                    {new Date(c.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-ink-soft">{c.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
