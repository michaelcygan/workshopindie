import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ChevronUp, ChevronDown, MoreHorizontal, Trash2, EyeOff, Eye, Reply, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportDialog } from "@/components/report-dialog";
import { useModerationChecker } from "@/lib/moderation/client";
import { cn } from "@/lib/utils";
import { BLOG_COMMENT_MAX, BLOG_COMMENT_SPAM } from "@/lib/blog-comments.shared";
import {
  postBlogComment,
  deleteBlogComment,
  replyToBlogComment,
  setBlogCommentHidden,
  setBlogCommentVote,
} from "@/lib/blog-comments.functions";

type ProfileLite = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };

type Row = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  hidden: boolean;
  author_reply: string | null;
  author_reply_by: string | null;
  author_replied_at: string | null;
  profiles: ProfileLite | null;
  author_reply_profile: ProfileLite | null;
};

type VoteRow = { comment_id: string; score: number; viewer_vote: number | null };

const LIMIT = 50;

export function BlogComments({
  postId,
  authorProfileIds,
}: {
  postId: string;
  /** Post creator + primary author + co-authors. UI hint only; the server re-checks. */
  authorProfileIds: Array<string | null | undefined>;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mod = useModerationChecker();

  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [modError, setModError] = useState<string | null>(null);
  const [replyOpenFor, setReplyOpenFor] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);

  const postFn = useServerFn(postBlogComment);
  const deleteFn = useServerFn(deleteBlogComment);
  const replyFn = useServerFn(replyToBlogComment);
  const hideFn = useServerFn(setBlogCommentHidden);
  const voteFn = useServerFn(setBlogCommentVote);

  const isAuthor = !!user && authorProfileIds.filter(Boolean).includes(user.id);

  const { data: comments, isLoading } = useQuery({
    queryKey: ["blog-comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_comments")
        .select(
          "id,body,created_at,user_id,hidden,author_reply,author_reply_by,author_replied_at," +
            "profiles:profiles!blog_comments_user_id_fkey(id,username,display_name,avatar_url)," +
            "author_reply_profile:profiles!blog_comments_author_reply_by_fkey(id,username,display_name,avatar_url)",
        )
        .eq("blog_post_id", postId)
        .order("created_at", { ascending: true })
        .limit(LIMIT);
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const { data: votes } = useQuery({
    queryKey: ["blog-comment-votes", postId, user?.id ?? "anon"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_blog_comment_vote_summary", {
        _blog_post_id: postId,
      });
      if (error) throw error;
      return (data ?? []) as VoteRow[];
    },
  });

  const voteBy = useMemo(() => {
    const m = new Map<string, VoteRow>();
    for (const v of votes ?? []) m.set(v.comment_id, v);
    return m;
  }, [votes]);

  const rows = comments ?? [];
  const publicCount = rows.filter((c) => !c.hidden).length;

  function refresh() {
    qc.invalidateQueries({ queryKey: ["blog-comments", postId] });
    qc.invalidateQueries({ queryKey: ["blog-comment-votes", postId] });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return navigate({ to: "/login" });
    const trimmed = body.trim();
    if (!trimmed) return;
    setModError(null);
    const pre = mod.check(trimmed, { ...BLOG_COMMENT_SPAM });
    if (!pre.ok) {
      setModError(pre.message);
      return;
    }
    setPosting(true);
    try {
      await postFn({ data: { postId, body: trimmed } });
      setBody("");
      refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setModError(msg);
      toast.error(msg);
    } finally {
      setPosting(false);
    }
  }

  async function onDelete(c: Row) {
    try {
      await deleteFn({ data: { commentId: c.id } });
      toast.success("Comment deleted");
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function onToggleHidden(c: Row) {
    try {
      await hideFn({ data: { commentId: c.id, hidden: !c.hidden } });
      toast.success(c.hidden ? "Comment restored" : "Comment hidden");
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function submitReply(commentId: string) {
    const trimmed = replyBody.trim();
    if (!trimmed) return;
    const pre = mod.check(trimmed, { ...BLOG_COMMENT_SPAM });
    if (!pre.ok) {
      toast.error(pre.message);
      return;
    }
    setReplyPosting(true);
    try {
      await replyFn({ data: { commentId, body: trimmed } });
      setReplyBody("");
      setReplyOpenFor(null);
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setReplyPosting(false);
    }
  }

  async function onVote(c: Row, next: 1 | -1) {
    if (!user) {
      toast.error("Sign in to vote.");
      return;
    }
    const current = voteBy.get(c.id)?.viewer_vote ?? null;
    const value = current === next ? 0 : next;
    try {
      await voteFn({ data: { commentId: c.id, value } });
      qc.invalidateQueries({ queryKey: ["blog-comment-votes", postId] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section className="mt-12 border-t border-border pt-8 md:mt-14">
      <h2 className="font-display text-xl text-ink">
        Comments{publicCount > 0 ? ` · ${publicCount}` : ""}
      </h2>

      {user ? (
        <form onSubmit={submit} className="mt-4 space-y-2">
          <Textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (modError) setModError(null);
            }}
            placeholder="Say something thoughtful."
            rows={3}
            maxLength={BLOG_COMMENT_MAX}
            aria-invalid={!!modError}
            aria-describedby={modError ? "blog-comment-mod-error" : undefined}
          />
          {modError && (
            <p id="blog-comment-mod-error" role="alert" className="text-xs text-destructive">
              {modError}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" size="sm" className="rounded-md" disabled={posting || !body.trim()}>
              {posting ? "Posting…" : "Post comment"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
          <p className="text-sm text-ink-soft">Join the conversation.</p>
          <Button size="sm" variant="outline" className="rounded-md" onClick={() => navigate({ to: "/login" })}>
            Sign in to comment
          </Button>
        </div>
      )}

      <div className="mt-8 space-y-6">
        {isLoading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-ink-muted">No comments yet. Be the first.</p>
        ) : (
          rows.map((c) => {
            const name = c.profiles?.display_name || c.profiles?.username || "Member";
            const isMine = user?.id === c.user_id;
            const v = voteBy.get(c.id);
            const score = v?.score ?? 0;
            const mine = v?.viewer_vote ?? null;
            const replyName =
              c.author_reply_profile?.display_name || c.author_reply_profile?.username || "Author";

            return (
              <article key={c.id} className={cn("flex gap-3", c.hidden && "opacity-60")}>
                <Avatar className="mt-0.5 h-8 w-8 shrink-0">
                  <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[11px]">{name[0]}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    {c.profiles?.username ? (
                      <Link
                        to="/$username"
                        params={{ username: c.profiles.username }}
                        className="font-medium text-ink hover:underline"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{name}</span>
                    )}
                    <span className="text-xs text-ink-muted">
                      · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </span>
                    {c.hidden && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-ink-muted">
                        Hidden by author
                      </span>
                    )}
                  </div>

                  <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-[1.7] text-ink-soft">
                    {c.body}
                  </p>

                  <div className="mt-2 flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Upvote"
                      aria-pressed={mine === 1}
                      onClick={() => onVote(c, 1)}
                      className={cn(
                        "rounded-full p-1 text-ink-muted transition hover:bg-muted hover:text-ink",
                        mine === 1 && "text-primary",
                      )}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <span className="min-w-5 text-center text-xs tabular-nums text-ink-soft">{score}</span>
                    <button
                      type="button"
                      aria-label="Downvote"
                      aria-pressed={mine === -1}
                      onClick={() => onVote(c, -1)}
                      className={cn(
                        "rounded-full p-1 text-ink-muted transition hover:bg-muted hover:text-ink",
                        mine === -1 && "text-primary",
                      )}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>

                    {user && (
                      <div className="ml-auto">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label="Comment actions"
                              className="rounded-full p-1 text-ink-muted hover:bg-muted hover:text-ink"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isMine && (
                              <DropdownMenuItem onClick={() => onDelete(c)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            )}
                            {isAuthor && !c.author_reply && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setReplyOpenFor(c.id);
                                  setReplyBody("");
                                }}
                              >
                                <Reply className="mr-2 h-4 w-4" /> Reply as author
                              </DropdownMenuItem>
                            )}
                            {isAuthor && (
                              <DropdownMenuItem onClick={() => onToggleHidden(c)}>
                                {c.hidden ? (
                                  <>
                                    <Eye className="mr-2 h-4 w-4" /> Unhide
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="mr-2 h-4 w-4" /> Hide
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}
                            {!isMine && (
                              <ReportDialog
                                entityType="blog_comment"
                                entityId={c.id}
                                trigger={
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Flag className="mr-2 h-4 w-4" /> Report
                                  </DropdownMenuItem>
                                }
                              />
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>

                  {replyOpenFor === c.id && (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="Respond as the author…"
                        rows={2}
                        maxLength={BLOG_COMMENT_MAX}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="rounded-md"
                          onClick={() => setReplyOpenFor(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-md"
                          disabled={replyPosting || !replyBody.trim()}
                          onClick={() => submitReply(c.id)}
                        >
                          {replyPosting ? "Posting…" : "Post response"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {c.author_reply && (
                    <div className="mt-3 border-l-2 border-border pl-3">
                      <div className="flex flex-wrap items-center gap-x-2 text-sm">
                        {c.author_reply_profile?.username ? (
                          <Link
                            to="/$username"
                            params={{ username: c.author_reply_profile.username }}
                            className="font-medium text-ink hover:underline"
                          >
                            {replyName}
                          </Link>
                        ) : (
                          <span className="font-medium text-ink">{replyName}</span>
                        )}
                        <span className="text-[10px] uppercase tracking-[0.18em] text-primary">Author</span>
                        {c.author_replied_at && (
                          <span className="text-xs text-ink-muted">
                            · {formatDistanceToNow(new Date(c.author_replied_at), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-[1.7] text-ink-soft">
                        {c.author_reply}
                      </p>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
