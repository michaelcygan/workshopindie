import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { MoreHorizontal, Reply, MessageCircle, EyeOff, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { setCommentHidden, replyToComment, postComment } from "@/lib/comments.functions";
import { openOrCreateConversation } from "@/lib/dms.functions";
import { useModerationChecker } from "@/lib/moderation/client";

type Row = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  owner_hidden: boolean;
  profiles: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
};

export function CommentThread({ workId, ownerId }: { workId: string; ownerId?: string | null }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [replyOpenFor, setReplyOpenFor] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);

  const isOwner = !!user && !!ownerId && user.id === ownerId;
  const setHiddenFn = useServerFn(setCommentHidden);
  const replyFn = useServerFn(replyToComment);
  const postFn = useServerFn(postComment);
  const openConvo = useServerFn(openOrCreateConversation);
  const mod = useModerationChecker();
  const [modError, setModError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["comments", workId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id,body,created_at,user_id,parent_id,owner_hidden,profiles(display_name,username,avatar_url)")
        .eq("work_id", workId)
        .eq("hidden", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const { topLevel, repliesByParent, hiddenCount } = useMemo(() => {
    const rows = data ?? [];
    const top: Row[] = [];
    const byParent: Record<string, Row[]> = {};
    for (const r of rows) {
      if (r.parent_id) (byParent[r.parent_id] ||= []).push(r);
      else top.push(r);
    }
    const hc = top.filter((r) => r.owner_hidden).length;
    return { topLevel: top, repliesByParent: byParent, hiddenCount: hc };
  }, [data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return navigate({ to: "/login" });
    const trimmed = body.trim();
    if (!trimmed) return;
    setModError(null);
    const pre = mod.check(trimmed, { maxLinks: 4, maxRepeatChars: 25 });
    if (!pre.ok) { setModError(pre.message); return; }
    setPosting(true);
    try {
      await postFn({ data: { workId, body: trimmed } });
      setBody("");
      qc.invalidateQueries({ queryKey: ["comments", workId] });
    } catch (err) {
      const msg = (err as Error).message;
      setModError(msg);
      toast.error(msg);
    } finally {
      setPosting(false);
    }
  }

  async function onToggleHidden(c: Row) {
    try {
      await setHiddenFn({ data: { commentId: c.id, hidden: !c.owner_hidden } });
      toast.success(c.owner_hidden ? "Comment restored" : "Comment hidden");
      qc.invalidateQueries({ queryKey: ["comments", workId] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onMessage(c: Row) {
    try {
      const r = await openConvo({ data: { otherUserId: c.user_id } });
      navigate({ to: "/dms/$conversationId", params: { conversationId: r.conversationId } });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function submitReply(parentId: string) {
    if (!replyBody.trim()) return;
    setReplyPosting(true);
    try {
      await replyFn({ data: { commentId: parentId, body: replyBody.trim() } });
      setReplyBody("");
      setReplyOpenFor(null);
      qc.invalidateQueries({ queryKey: ["comments", workId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setReplyPosting(false);
    }
  }

  function renderComment(c: Row, opts: { isReply?: boolean } = {}) {
    const name = c.profiles?.display_name || c.profiles?.username || "Anon";
    const isCommenter = user?.id === c.user_id;
    const isOwnerReply = !!ownerId && c.user_id === ownerId && !!c.parent_id;
    const canOwnerAct = isOwner && !isCommenter && !isOwnerReply;
    const dimmed = c.owner_hidden;

    return (
      <div key={c.id} className={cn("flex gap-3", opts.isReply && "ml-11")}>
        <Avatar className="h-9 w-9 mt-0.5">
          <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">{name[0]}</AvatarFallback>
        </Avatar>
        <div className={cn("flex-1 rounded-2xl border border-border bg-surface px-4 py-3", dimmed && "opacity-60")}>
          <div className="flex items-center gap-2 text-sm">
            {c.profiles?.username ? (
              <Link to="/u/$username" params={{ username: c.profiles.username }} className="font-medium text-ink hover:underline">
                {name}
              </Link>
            ) : (
              <span className="font-medium text-ink">{name}</span>
            )}
            {isOwnerReply && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Author reply</span>
            )}
            {c.owner_hidden && (isOwner || isCommenter) && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-ink-muted">
                {isOwner ? "Hidden" : "Only visible to you"}
              </span>
            )}
            <span className="text-xs text-ink-muted">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
            {canOwnerAct && (
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="rounded-full p-1 hover:bg-muted text-ink-muted" aria-label="Comment actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!opts.isReply && !repliesByParent[c.id]?.length && (
                      <DropdownMenuItem onClick={() => { setReplyOpenFor(c.id); setReplyBody(""); }}>
                        <Reply className="h-4 w-4 mr-2" /> Reply
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onMessage(c)}>
                      <MessageCircle className="h-4 w-4 mr-2" /> Message
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggleHidden(c)}>
                      {c.owner_hidden ? (
                        <><Eye className="h-4 w-4 mr-2" /> Unhide</>
                      ) : (
                        <><EyeOff className="h-4 w-4 mr-2" /> Hide</>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{c.body}</p>

          {replyOpenFor === c.id && (
            <div className="mt-3 space-y-2">
              <Textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write a reply as author…"
                rows={2}
                maxLength={1000}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => setReplyOpenFor(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  disabled={replyPosting || !replyBody.trim()}
                  onClick={() => submitReply(c.id)}
                >
                  {replyPosting ? "Posting…" : "Post reply"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const visibleTop = topLevel.filter((c) => !c.owner_hidden || showHidden || (user && (c.user_id === user.id || isOwner)));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-ink">Comments</h3>
        {isOwner && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            className="text-xs text-ink-muted hover:text-ink underline-offset-4 hover:underline"
          >
            {showHidden ? "Collapse hidden" : `Show hidden (${hiddenCount})`}
          </button>
        )}
      </div>

      <form onSubmit={submit} className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); if (modError) setModError(null); }}
          placeholder={user ? "Say something thoughtful." : "Sign in to comment."}
          rows={3}
          maxLength={1000}
          disabled={!user}
          aria-invalid={!!modError}
          aria-describedby={modError ? "comment-mod-error" : undefined}
        />
        {modError && (
          <p id="comment-mod-error" role="alert" className="text-xs text-destructive">
            {modError}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={posting || !body.trim()} className="rounded-full">
            {user ? (posting ? "Posting…" : "Post comment") : "Sign in to comment"}
          </Button>
        </div>
      </form>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-ink-muted">Loading…</div>
        ) : visibleTop.length === 0 ? (
          <div className="text-sm text-ink-muted">No comments yet. Be the first.</div>
        ) : (
          visibleTop.map((c) => (
            <div key={c.id} className="space-y-3">
              {renderComment(c)}
              {(repliesByParent[c.id] ?? []).map((r) => renderComment(r, { isReply: true }))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
