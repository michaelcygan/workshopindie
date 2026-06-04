import { useEffect, useMemo, useState } from "react";
import { BarChart3, Plus, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Poll = {
  id: string;
  workshop_id: string;
  created_by: string | null;
  question: string;
  options: string[];
  status: "open" | "closed";
  created_at: string;
};

type Vote = { poll_id: string; choice_index: number };

export function ChatPolls({ workshopId }: { workshopId: string }) {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [tallies, setTallies] = useState<Record<string, number[]>>({});
  const [composing, setComposing] = useState(false);

  // Load polls + votes for tallies
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: ps } = await supabase
        .from("workshop_polls")
        .select("id,workshop_id,created_by,question,options,status,created_at")
        .eq("workshop_id", workshopId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      const list = ((ps ?? []) as unknown as Poll[]).map((p) => ({
        ...p,
        options: Array.isArray(p.options) ? p.options : [],
      }));
      setPolls(list);
      if (list.length) {
        const { data: vs } = await supabase
          .from("workshop_poll_votes")
          .select("poll_id,choice_index")
          .in(
            "poll_id",
            list.map((p) => p.id),
          );
        if (cancelled) return;
        const map: Record<string, number[]> = {};
        for (const p of list) map[p.id] = new Array(p.options.length).fill(0);
        for (const v of (vs ?? []) as Vote[]) {
          if (map[v.poll_id] && v.choice_index < map[v.poll_id].length)
            map[v.poll_id][v.choice_index]++;
        }
        setTallies(map);
      }
    }
    load();

    const ch = supabase
      .channel(`polls:${workshopId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workshop_polls", filter: `workshop_id=eq.${workshopId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workshop_poll_votes" },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [workshopId]);

  const openPolls = useMemo(() => polls.filter((p) => p.status === "open"), [polls]);

  async function vote(pollId: string, idx: number) {
    const { error } = await supabase.rpc("cast_workshop_poll_vote", {
      _poll_id: pollId,
      _choice_index: idx,
    });
    if (error) toast.error(error.message);
  }

  async function closePoll(pollId: string) {
    const { error } = await supabase
      .from("workshop_polls")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", pollId);
    if (error) toast.error(error.message);
  }

  if (!user) return null;
  if (openPolls.length === 0 && !composing) {
    return (
      <div className="border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
        >
          <BarChart3 className="h-3.5 w-3.5" /> Start a poll
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-surface-2/40 px-3 py-2 space-y-2 max-h-64 overflow-y-auto">
      {openPolls.map((p) => {
        const counts = tallies[p.id] ?? new Array(p.options.length).fill(0);
        const total = counts.reduce((a, b) => a + b, 0);
        const mine = p.created_by === user.id;
        return (
          <div key={p.id} className="rounded-lg border border-border bg-background p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs font-medium text-ink">{p.question}</div>
              {mine && (
                <button
                  onClick={() => closePoll(p.id)}
                  className="text-[10px] text-ink-muted hover:text-ink"
                  title="Close poll"
                >
                  Close
                </button>
              )}
            </div>
            <div className="mt-1.5 space-y-1">
              {p.options.map((opt, i) => {
                const c = counts[i] ?? 0;
                const pct = total > 0 ? Math.round((c / total) * 100) : 0;
                return (
                  <button
                    key={i}
                    onClick={() => vote(p.id, i)}
                    className="relative block w-full overflow-hidden rounded border border-border px-2 py-1 text-left text-xs hover:border-ink"
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-muted"
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex justify-between text-ink">
                      <span className="truncate">{opt}</span>
                      <span className="tabular-nums text-ink-muted ml-2">{c} · {pct}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-1 text-[10px] text-ink-muted">
              Anonymous · {total} {total === 1 ? "vote" : "votes"}
            </div>
          </div>
        );
      })}
      {composing ? (
        <PollComposer workshopId={workshopId} onDone={() => setComposing(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
        >
          <Plus className="h-3.5 w-3.5" /> New poll
        </button>
      )}
    </div>
  );
}

function PollComposer({ workshopId, onDone }: { workshopId: string; onDone: () => void }) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user) return;
    const cleanOpts = opts.map((o) => o.trim()).filter(Boolean);
    if (!q.trim() || cleanOpts.length < 2) {
      toast.error("Need a question and at least 2 options");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("workshop_polls").insert({
      workshop_id: workshopId,
      created_by: user.id,
      question: q.trim().slice(0, 280),
      options: cleanOpts.slice(0, 8),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onDone();
  }

  return (
    <div className="rounded-lg border border-border bg-background p-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-ink flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" /> New poll
        </div>
        <button onClick={onDone} className="text-ink-muted hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ask a question…"
        maxLength={280}
        className="h-8 text-xs"
      />
      <div className="space-y-1">
        {opts.map((o, i) => (
          <div key={i} className="flex gap-1">
            <Input
              value={o}
              onChange={(e) => setOpts(opts.map((x, j) => (i === j ? e.target.value : x)))}
              placeholder={`Option ${i + 1}`}
              maxLength={80}
              className="h-8 text-xs"
            />
            {opts.length > 2 && (
              <button
                onClick={() => setOpts(opts.filter((_, j) => j !== i))}
                className="text-ink-muted hover:text-ink px-1"
                aria-label="Remove option"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {opts.length < 8 && (
          <button
            onClick={() => setOpts([...opts, ""])}
            className="text-[10px] text-ink-muted hover:text-ink"
          >
            + Add option
          </button>
        )}
      </div>
      <Button size="sm" className="h-7 text-xs w-full" onClick={submit} disabled={busy}>
        <Check className="h-3.5 w-3.5 mr-1" /> Start poll
      </Button>
    </div>
  );
}
