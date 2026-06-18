import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Trash2, Link as LinkIcon, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// v1: external recording-link holder. Replaces the in-app multi-source recorder.
// Only hosts can set/clear; only approved platforms are accepted.

type Scope =
  | { kind: "instant"; roomId: string }
  | { kind: "persistent"; workshopId: string };

type Props = {
  scope: Scope;
  toolId: string;
  isHost: boolean;
};

const PLATFORMS: { host: string; name: string }[] = [
  { host: "zoom.us", name: "Zoom" },
  { host: "zoom.com", name: "Zoom" },
  { host: "riverside.fm", name: "Riverside" },
  { host: "squadcast.fm", name: "SquadCast" },
  { host: "descript.com", name: "Descript" },
  { host: "streamyard.com", name: "StreamYard" },
  { host: "restream.io", name: "Restream" },
  { host: "cleanfeed.net", name: "Cleanfeed" },
  { host: "loom.com", name: "Loom" },
  { host: "meet.google.com", name: "Google Meet" },
  { host: "teams.microsoft.com", name: "Microsoft Teams" },
  { host: "teams.live.com", name: "Microsoft Teams" },
];

function detectPlatform(url: string): { name: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const match = PLATFORMS.find((p) => host === p.host || host.endsWith("." + p.host));
    return match ? { name: match.name } : null;
  } catch {
    return null;
  }
}

function itemsTable(scope: Scope) {
  return scope.kind === "instant" ? "instant_tool_items" : "workshop_tool_items";
}

export function WorkshopRecordingLink({ scope, toolId, isHost }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const table = itemsTable(scope);

  const { data: item } = useQuery({
    queryKey: ["recording-link", scope.kind, toolId],
    enabled: !!user,
    refetchInterval: 8000,
    queryFn: async () => {
      const { data } = await (supabase.from(table) as any)
        .select("id,url,title,created_at")
        .eq("tool_id", toolId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { id: string; url: string | null; title: string | null } | null;
    },
  });

  async function save() {
    if (!user) return;
    const url = draft.trim();
    if (!url) return;
    const platform = detectPlatform(url);
    if (!platform) {
      toast.error("Use a Zoom, Riverside, SquadCast, Descript, StreamYard, Restream, Cleanfeed, Loom, Google Meet, or Teams link.");
      return;
    }
    setSaving(true);
    try {
      // Replace any existing link so there's only one active.
      if (item?.id) {
        await (supabase.from(table) as any).delete().eq("id", item.id);
      }
      const payload: any = { tool_id: toolId, url, title: platform.name, created_by_user_id: user.id };
      const { error } = await (supabase.from(table) as any).insert(payload);
      if (error) throw error;
      setDraft("");
      qc.invalidateQueries({ queryKey: ["recording-link", scope.kind, toolId] });
      toast.success(`${platform.name} link saved`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save link");
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    if (!item?.id) return;
    if (typeof window !== "undefined" && !window.confirm("Remove the recording link?")) return;
    const { error } = await (supabase.from(table) as any).delete().eq("id", item.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["recording-link", scope.kind, toolId] });
  }

  const platform = item?.url ? detectPlatform(item.url) : null;

  return (
    <div className="space-y-3">
      {item?.url ? (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Recording on</div>
          <div className="mt-1 font-display text-lg text-ink">{platform?.name ?? item.title ?? "External recorder"}</div>
          <p className="mt-1 break-all text-xs text-ink-muted">{item.url}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button asChild size="sm" className="rounded-full gap-1.5">
              <a href={item.url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Join recording
              </a>
            </Button>
            {isHost && (
              <Button onClick={clear} size="sm" variant="ghost" className="rounded-full gap-1.5 text-ink-muted">
                <Trash2 className="h-3.5 w-3.5" />
                Remove link
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-4 text-center">
          <div className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted text-ink-muted">
            <LinkIcon className="h-4 w-4" />
          </div>
          <p className="mt-2 text-sm text-ink">
            {isHost ? "Drop in your recording link" : "Waiting for the host to add a recording link…"}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Zoom · Riverside · SquadCast · Descript · StreamYard · Restream · Cleanfeed · Loom · Google Meet · Teams
          </p>
        </div>
      )}

      {isHost && (
        <div className="rounded-2xl border border-border bg-surface-2 p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            <ShieldCheck className="h-3 w-3" /> Approved platforms only
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="https://zoom.us/j/…"
              className="flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(); } }}
            />
            <Button onClick={save} disabled={saving || !draft.trim()} size="sm" className="rounded-full">
              {item?.url ? "Replace link" : "Save link"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
