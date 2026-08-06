import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ExternalLink, Loader2, Plus, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInfluenceMutations, useInfluences } from "@/hooks/use-influences";
import { MAX_INFLUENCES, influenceDisplay, type Influence } from "@/lib/influences/types";
import { cn } from "@/lib/utils";

type WorkHit = { id: string; title: string; cover_url: string | null; category: string | null };

function useWorkSearch(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: ["influence-work-search", q],
    enabled: q.length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<WorkHit[]> => {
      const { data } = await supabase
        .from("works")
        .select("id,title,cover_url,category")
        .eq("status", "published")
        .eq("visibility", "public")
        .ilike("title", `%${q}%`)
        .limit(12);
      return (data ?? []) as WorkHit[];
    },
  });
}

function Thumb({ url, label }: { url: string | null; label: string }) {
  return (
    <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-surface-2">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wide text-ink-muted">
          {label.slice(0, 3)}
        </div>
      )}
    </div>
  );
}

/** Owner-side editor. Every action persists immediately. */
export function InfluencesEditor({ profileId }: { profileId: string | undefined }) {
  const { data: influences = [], isLoading } = useInfluences(profileId);
  const m = useInfluenceMutations(profileId);
  const [open, setOpen] = useState(false);
  const atCap = influences.length >= MAX_INFLUENCES;

  function move(index: number, dir: -1 | 1) {
    const next = [...influences];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    m.reorder.mutate(next.map((i) => i.id), {
      onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't reorder"),
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          {influences.length}/{MAX_INFLUENCES} added. Influences only appear on your profile once
          you add one.
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1 rounded-md"
          disabled={atCap}
          onClick={() => setOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Add influence
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : influences.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nothing yet. Add a Workshop piece or a link to something that shaped your work.
        </p>
      ) : (
        <ul className="space-y-2">
          {influences.map((influence, i) => (
            <InfluenceRow
              key={influence.id}
              influence={influence}
              first={i === 0}
              last={i === influences.length - 1}
              onMove={(dir) => move(i, dir)}
              onRemove={() =>
                m.remove.mutate(influence.id, {
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't remove"),
                })
              }
              onRename={(title) =>
                m.update.mutate(
                  { id: influence.id, title },
                  { onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save") },
                )
              }
            />
          ))}
        </ul>
      )}

      <AddInfluenceDialog
        open={open}
        onOpenChange={setOpen}
        atCap={atCap}
        mutations={m}
      />
    </div>
  );
}

function InfluenceRow({
  influence,
  first,
  last,
  onMove,
  onRemove,
  onRename,
}: {
  influence: Influence;
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onRename: (title: string) => void;
}) {
  const d = influenceDisplay(influence);
  const [title, setTitle] = useState(d.title);
  useEffect(() => setTitle(d.title), [d.title]);
  const isWork = influence.source_kind === "workshop_work";
  const missing = isWork && !influence.work;

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-background p-2">
      <Thumb url={d.thumbnail} label={d.title} />
      <div className="min-w-0 flex-1 space-y-1">
        {isWork ? (
          <p className="line-clamp-1 text-sm font-medium text-ink">{d.title}</p>
        ) : (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== d.title && onRename(title.trim())}
            className="h-8"
            maxLength={200}
          />
        )}
        <p className="flex items-center gap-1 text-xs text-ink-muted">
          {isWork ? (
            missing ? "Workshop piece — no longer available" : "Workshop piece"
          ) : (
            <>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span className="line-clamp-1">{influence.external_url}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button type="button" size="icon" variant="ghost" disabled={first} onClick={() => onMove(-1)} aria-label="Move up">
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" disabled={last} onClick={() => onMove(1)} aria-label="Move down">
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={onRemove} aria-label="Remove influence">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

function AddInfluenceDialog({
  open,
  onOpenChange,
  atCap,
  mutations,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  atCap: boolean;
  mutations: ReturnType<typeof useInfluenceMutations>;
}) {
  const [tab, setTab] = useState<"work" | "link">("work");
  const [term, setTerm] = useState("");
  const [url, setUrl] = useState("");
  const { data: hits = [], isFetching } = useWorkSearch(term);
  const busy = mutations.add.isPending || mutations.resolveUrl.isPending;

  useEffect(() => {
    if (!open) {
      setTerm("");
      setUrl("");
      setTab("work");
    }
  }, [open]);

  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't add that");

  function addWork(id: string) {
    mutations.add.mutate(
      { kind: "workshop_work", work_id: id },
      {
        onSuccess: () => {
          toast.success("Influence added");
          onOpenChange(false);
        },
        onError: fail,
      },
    );
  }

  async function addLink() {
    const raw = url.trim();
    if (!raw) return;
    try {
      const meta = await mutations.resolveUrl.mutateAsync(raw);
      await mutations.add.mutateAsync({
        kind: "external",
        url: meta.url,
        title: meta.title,
        creator_name: meta.creator_name,
        category: meta.category,
        thumbnail_url: meta.thumbnail_url,
        provider: meta.provider,
      });
      toast.success("Influence added");
      onOpenChange(false);
    } catch (e) {
      fail(e);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add an influence</DialogTitle>
          <DialogDescription>
            Something that shaped your work — a piece on Workshop, or a link to anything else.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
          {(["work", "link"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm transition-colors",
                tab === t ? "bg-background text-ink shadow-sm" : "text-ink-muted hover:text-ink",
              )}
            >
              {t === "work" ? "On Workshop" : "A link"}
            </button>
          ))}
        </div>

        {atCap && (
          <p className="text-sm text-ink-muted">
            You&apos;ve reached {MAX_INFLUENCES}. Remove one to add another.
          </p>
        )}

        {!atCap && tab === "work" && (
          <div className="space-y-2">
            <Label htmlFor="influence-search">Search published works</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <Input
                id="influence-search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Title…"
                className="pl-9"
              />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {term.trim().length < 2 ? (
                <p className="py-4 text-center text-sm text-ink-muted">Type at least 2 characters.</p>
              ) : isFetching ? (
                <p className="py-4 text-center text-sm text-ink-muted">Searching…</p>
              ) : hits.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-muted">Nothing matched.</p>
              ) : (
                hits.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    disabled={busy}
                    onClick={() => addWork(w.id)}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-surface-2 disabled:opacity-60"
                  >
                    <Thumb url={w.cover_url} label={w.title} />
                    <span className="line-clamp-2 text-sm text-ink">{w.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {!atCap && tab === "link" && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="influence-url">Link</Label>
              <Input
                id="influence-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                inputMode="url"
              />
              <p className="text-xs text-ink-muted">
                We&apos;ll try to pull the title and cover. You can edit the title afterwards.
              </p>
            </div>
            <Button type="button" className="w-full rounded-md" disabled={busy || !url.trim()} onClick={addLink}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add influence"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
