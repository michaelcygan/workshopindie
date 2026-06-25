import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Collab = { id: string; title: string; slug: string; created_at: string };

/**
 * Modal that lets a group member search their own open collabs and pin one
 * to the group's Today board. Also idempotently adds the collab to
 * `group_collabs` so it surfaces in normal group listings.
 */
export function GroupTodayPinPicker({
  open,
  onOpenChange,
  groupId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: mine = [], isLoading } = useQuery({
    queryKey: ["my-open-collabs", user?.id],
    enabled: !!user && open,
    queryFn: async (): Promise<Collab[]> => {
      const { data, error } = await supabase
        .from("collab_posts")
        .select("id,title,slug,created_at")
        .eq("user_id", user!.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Collab[];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return mine;
    return mine.filter((c) => c.title.toLowerCase().includes(s));
  }, [mine, q]);

  const pin = useMutation({
    mutationFn: async (collab: Collab) => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase
        .from("group_today_pins")
        .insert({ group_id: groupId, user_id: user.id, collab_id: collab.id } as never);
      if (error) throw error;
      // Best-effort: also surface it in the group's regular collab list.
      await supabase
        .from("group_collabs")
        .upsert(
          { group_id: groupId, collab_id: collab.id, added_by: user.id } as never,
          { onConflict: "group_id,collab_id" },
        );
    },
    onSuccess: () => {
      toast.success("Pinned to today");
      qc.invalidateQueries({ queryKey: ["group", groupId, "today-pins"] });
      qc.invalidateQueries({ queryKey: ["group", groupId, "fresh-collabs"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pin one of your collabs</DialogTitle>
          <DialogDescription>
            It'll appear at the top of today's board until midnight.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your open collabs"
            className="w-full rounded-xl border border-border bg-surface px-9 py-2 text-sm text-ink placeholder:text-ink-muted/70 focus:border-ring focus:outline-none"
            autoFocus
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-2" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-ink-muted">
              {mine.length === 0
                ? "You don't have any open collabs to pin yet."
                : "No matches."}
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pin.mutate(c)}
                    disabled={pin.isPending}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-muted/60 disabled:opacity-50"
                  >
                    <div className="line-clamp-1 font-medium">{c.title}</div>
                    <div className="text-[11px] text-ink-muted">
                      Posted {new Date(c.created_at).toLocaleDateString()}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
