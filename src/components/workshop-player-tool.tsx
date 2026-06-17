import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Play, Plus, SkipForward, Trash2, ListMusic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmbedPlayer } from "@/components/embed-player";
import { toEmbedUrl, providerOf, providerNiceLabel } from "@/lib/media-providers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Scope =
  | { kind: "persistent"; workshopId: string; hostUserId: string }
  | { kind: "instant"; roomId: string; hostUserId: string | null };

type Item = {
  id: string;
  title: string | null;
  body: string | null;
  url: string | null;
  created_at: string;
  created_by_user_id: string;
  profile: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
};

export function WorkshopPlayerTool({
  scope,
  toolId,
}: {
  scope: Scope;
  toolId: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isInstant = scope.kind === "instant";
  const itemsTable = isInstant ? "instant_tool_items" : "workshop_tool_items";
  const profileFk = isInstant
    ? "instant_tool_items_created_by_user_id_fkey"
    : "workshop_tool_items_created_by_user_id_fkey";
  const isHost = scope.hostUserId !== null && user?.id === scope.hostUserId;

  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const queryKey = ["ws-player-items", scope.kind, toolId] as const;
  const { data: items = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await (supabase.from(itemsTable) as any)
        .select(
          `id,title,body,url,created_at,created_by_user_id, profile:profiles!${profileFk}(display_name,username,avatar_url)`,
        )
        .eq("tool_id", toolId)
        .order("created_at", { ascending: true });
      return (data ?? []) as Item[];
    },
  });

  // Default playing item = first valid playable, or whatever the user clicked.
  const playable = useMemo(
    () =>
      items
        .map((it) => ({ it, embed: it.url ? toEmbedUrl(it.url) : null }))
        .filter((x): x is { it: Item; embed: string } => !!x.embed),
    [items],
  );

  useEffect(() => {
    if (activeId && playable.some((p) => p.it.id === activeId)) return;
    setActiveId(playable[0]?.it.id ?? null);
  }, [playable, activeId]);

  const active = playable.find((p) => p.it.id === activeId) ?? null;
  const activeIndex = active ? playable.findIndex((p) => p.it.id === active.it.id) : -1;
  const next = activeIndex >= 0 ? playable[activeIndex + 1] : undefined;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const u = url.trim();
    if (!u) return;
    const embed = toEmbedUrl(u);
    if (!embed) {
      toast.error("Site not supported yet. Try YouTube, Vimeo, SoundCloud, Spotify, Apple Music, Bandcamp, TikTok, Twitch, Loom…");
      return;
    }
    const provider = providerOf(u);
    setSubmitting(true);
    const { error } = await (supabase.from(itemsTable) as any).insert({
      tool_id: toolId,
      created_by_user_id: user.id,
      url: u,
      title: niceTitle(u),
      body: provider,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setUrl("");
    qc.invalidateQueries({ queryKey });
  }

  async function remove(id: string) {
    const { error } = await (supabase.from(itemsTable) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (activeId === id) setActiveId(null);
    qc.invalidateQueries({ queryKey });
  }

  return (
    <div className="p-4">
      <form onSubmit={add} className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          maxLength={500}
          placeholder="Paste a link — YouTube, Vimeo, SoundCloud, Spotify, Apple Music, Bandcamp, TikTok…"
        />
        <Button type="submit" size="sm" className="rounded-full" disabled={submitting}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </form>

      {active ? (
        <div className="mt-4 space-y-2">
          <EmbedPlayer
            url={active.embed}
            provider={(active.it.body as any) ?? undefined}
            title={active.it.title ?? undefined}
          />
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-ink-soft">
              {providerNiceLabel(active.it.body) ?? "Now playing"}
            </span>
            <span className="truncate">{active.it.title ?? active.it.url}</span>
            {next && (
              <button
                onClick={() => setActiveId(next.it.id)}
                className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-muted"
                title="Play next"
              >
                <SkipForward className="h-3.5 w-3.5" /> Next
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
          <ListMusic className="mx-auto mb-2 h-5 w-5" />
          Drop a link to start the queue. Everyone in the room sees it; playback is local.
        </div>
      )}

      {items.length > 0 && (
        <ol className="mt-4 space-y-1.5">
          {items.map((it, idx) => {
            const embed = it.url ? toEmbedUrl(it.url) : null;
            const name = it.profile?.display_name || it.profile?.username || "Anon";
            const canDelete = it.created_by_user_id === user?.id || isHost;
            const isActive = activeId === it.id;
            return (
              <li
                key={it.id}
                className={cn(
                  "group flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                  isActive ? "border-primary/40 bg-primary/5" : "border-border bg-surface-2",
                )}
              >
                <button
                  onClick={() => embed && setActiveId(it.id)}
                  disabled={!embed}
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition",
                    embed ? "bg-ink text-background hover:scale-105" : "bg-muted text-ink-muted",
                  )}
                  title={embed ? "Play" : "Not playable"}
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
                <span className="w-5 shrink-0 text-center text-[11px] text-ink-muted">{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ink">{it.title || it.url}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                    <Avatar className="h-3.5 w-3.5">
                      <AvatarImage src={it.profile?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[7px]">{name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{name}</span>
                    {it.body && (
                      <span className="rounded-full bg-background px-1.5 py-0.5 text-ink-soft">
                        {providerNiceLabel(it.body) ?? it.body}
                      </span>
                    )}
                    {!embed && (
                      <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-destructive">
                        Unsupported
                      </span>
                    )}
                  </div>
                </div>
                {it.url && (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-full p-1.5 text-ink-muted hover:bg-background hover:text-ink"
                    title="Open original"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {canDelete && (
                  <button
                    onClick={() => remove(it.id)}
                    className="rounded-full p-1.5 text-ink-muted hover:bg-background hover:text-destructive"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function niceTitle(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, "").replace(/^(embed|player|open|w|widget|fast)\./, "");
    const lastSeg = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const slug = decodeURIComponent(lastSeg).replace(/[-_]+/g, " ").slice(0, 80);
    return slug ? `${slug} · ${host}` : host;
  } catch {
    return null;
  }
}
