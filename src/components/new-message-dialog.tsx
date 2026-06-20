import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { openOrCreateConversation } from "@/lib/dms.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Candidate = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * "New message" picker. Lists people the viewer mutually follows
 * (the relationship that satisfies `can_dm`). RLS already prevents an
 * unauthorized DM, so this is a curated UX list — not a security gate.
 */
export function NewMessageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const openConv = useServerFn(openOrCreateConversation);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      setCandidates(null);
      // People I follow
      const { data: outRows } = await supabase
        .from("follows")
        .select("followed_user_id")
        .eq("follower_user_id", user.id);
      const outIds = new Set((outRows ?? []).map((r) => r.followed_user_id));
      if (!outIds.size) { if (!cancelled) setCandidates([]); return; }

      // …who also follow me back (mutuals)
      const { data: backRows } = await supabase
        .from("follows")
        .select("follower_user_id")
        .eq("followed_user_id", user.id)
        .in("follower_user_id", Array.from(outIds));
      const mutualIds = (backRows ?? []).map((r) => r.follower_user_id);
      if (!mutualIds.length) { if (!cancelled) setCandidates([]); return; }

      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", mutualIds)
        .limit(200);
      if (cancelled) return;
      const list = (profs ?? []) as Candidate[];
      list.sort((a, b) =>
        (a.display_name ?? a.username ?? "").localeCompare(b.display_name ?? b.username ?? "")
      );
      setCandidates(list);
    })();
    return () => { cancelled = true; };
  }, [open, user?.id]);

  const filtered = useMemo(() => {
    const list = candidates ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter((p) =>
      ((p.display_name ?? "") + " " + (p.username ?? "")).toLowerCase().includes(query)
    );
  }, [candidates, q]);

  async function startWith(p: Candidate) {
    if (busyId) return;
    setBusyId(p.id);
    try {
      const r = await openConv({
        data: { otherUserId: p.id, contextCollabPostId: null, contextWorkshopId: null },
      });
      onOpenChange(false);
      navigate({ to: "/dms/$conversationId", params: { conversationId: r.conversationId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start conversation");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New message</DialogTitle>
          <DialogDescription>
            Mutual follows only. To unlock someone new, follow each other or share a collab.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search mutuals…"
            className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div className="mt-1 max-h-[55vh] overflow-y-auto">
          {candidates === null ? (
            <div className="flex items-center justify-center py-8 text-sm text-ink-muted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink-muted">
              {candidates.length === 0
                ? "No mutuals yet. Follow people whose work you like — when they follow back, they show up here."
                : "No matches."}
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => startWith(p)}
                    disabled={busyId !== null}
                    className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-2 py-2 text-left transition hover:border-border hover:bg-muted/60 disabled:opacity-60"
                  >
                    <Avatar className="h-10 w-10 ring-1 ring-border">
                      {p.avatar_url ? <AvatarImage src={p.avatar_url} alt="" /> : null}
                      <AvatarFallback className="bg-gradient-to-br from-primary/15 to-coral/15 font-display text-sm text-ink">
                        {initials(p)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {p.display_name ?? p.username ?? "Someone"}
                      </p>
                      {p.username && (
                        <p className="truncate text-xs text-ink-muted">@{p.username}</p>
                      )}
                    </div>
                    {busyId === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-ink-muted" />
                    ) : (
                      <span className="text-[11px] text-ink-muted">Message →</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-2 flex justify-end">
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function initials(p: Candidate): string {
  const src = (p.display_name ?? p.username ?? "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
