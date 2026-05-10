import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type Row = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
};

export function CommentThread({ workId }: { workId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["comments", workId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id,body,created_at,user_id,profiles(display_name,username,avatar_url)")
        .eq("work_id", workId)
        .eq("hidden", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return navigate({ to: "/login" });
    if (!body.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("comments").insert({ user_id: user.id, work_id: workId, body: body.trim() });
    setPosting(false);
    if (error) return toast.error(error.message);
    setBody("");
    qc.invalidateQueries({ queryKey: ["comments", workId] });
  }

  return (
    <div className="space-y-5">
      <h3 className="font-display text-xl text-ink">Comments</h3>

      <form onSubmit={submit} className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={user ? "Say something thoughtful." : "Sign in to comment."}
          rows={3}
          maxLength={1000}
          disabled={!user}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={posting || !body.trim()} className="rounded-full">
            {user ? (posting ? "Posting…" : "Post comment") : "Sign in to comment"}
          </Button>
        </div>
      </form>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-ink-muted">Loading…</div>
        ) : !data || data.length === 0 ? (
          <div className="text-sm text-ink-muted">No comments yet. Be the first.</div>
        ) : (
          data.map((c) => {
            const name = c.profiles?.display_name || c.profiles?.username || "Anon";
            return (
              <div key={c.id} className="flex gap-3">
                <Avatar className="h-9 w-9 mt-0.5">
                  <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 rounded-2xl border border-border bg-surface px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    {c.profiles?.username ? (
                      <Link to="/u/$username" params={{ username: c.profiles.username }} className="font-medium text-ink hover:underline">
                        {name}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{name}</span>
                    )}
                    <span className="text-xs text-ink-muted">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{c.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
