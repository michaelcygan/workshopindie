import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as LinkIcon, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { detectLinkKind } from "@/lib/drive-link-kinds";
import { cn } from "@/lib/utils";

/**
 * Polymorphic Drive panel — links only for v1. Backs onto either:
 *  - `workshop_drive_links` (persistent Workshop), or
 *  - `instant_drive_links`  (live room).
 *
 * File uploads to the `instant-drive` / persistent buckets ship next.
 */
export type DrivePanelScope =
  | { kind: "persistent"; workshopId: string }
  | { kind: "instant"; roomId: string };

type DriveLink = {
  id: string;
  url: string;
  title: string | null;
  provider: string;
  note: string | null;
  added_by: string | null;
  created_at: string;
};

function tableFor(scope: DrivePanelScope) {
  return scope.kind === "persistent"
    ? { name: "workshop_drive_links" as const, parentCol: "workshop_id" as const, parentId: scope.workshopId }
    : { name: "instant_drive_links"  as const, parentCol: "room_id"     as const, parentId: scope.roomId };
}

function detectProvider(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host.includes("drive.google.com") || host.includes("docs.google.com")) return "google";
    if (host.includes("dropbox.com")) return "dropbox";
    if (host.includes("figma.com")) return "figma";
    if (host.includes("notion.so") || host.includes("notion.site")) return "notion";
    if (host.includes("github.com")) return "github";
    if (host.includes("vimeo.com")) return "vimeo";
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    if (host.includes("soundcloud.com")) return "soundcloud";
    return "other";
  } catch {
    return "other";
  }
}

export function WorkshopDrivePanel({ scope }: { scope: DrivePanelScope }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const t = tableFor(scope);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const queryKey = ["drive-links", scope.kind, t.parentId] as const;

  const { data: links = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await (supabase.from(t.name) as any)
        .select("id,url,title,provider,note,added_by,created_at")
        .eq(t.parentCol, t.parentId)
        .order("created_at", { ascending: false });
      return (data as DriveLink[]) ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`drive-${scope.kind}-${t.parentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: t.name, filter: `${t.parentCol}=eq.${t.parentId}` },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [scope.kind, t.name, t.parentCol, t.parentId, qc]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !url.trim()) return;
    try { new URL(url.trim()); } catch { return toast.error("That URL doesn't look right."); }
    setAdding(true);
    const { error } = await (supabase.from(t.name) as any).insert({
      [t.parentCol]: t.parentId,
      added_by: user.id,
      url: url.trim(),
      title: title.trim() || null,
      provider: detectProvider(url.trim()),
    });
    setAdding(false);
    if (error) return toast.error(error.message);
    setUrl(""); setTitle("");
  }

  async function remove(id: string) {
    const { error } = await (supabase.from(t.name) as any).delete().eq("id", id);
    if (error) toast.error(error.message);
  }

  return (
    <div>
      <form
        onSubmit={add}
        className="grid gap-2 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-[1fr_1fr_auto]"
      >
        <Input value={url} onChange={(e) => setUrl(e.target.value)} onBlur={(e) => setUrl(normalizeUrlOrKeep(e.target.value))} placeholder="Paste a link (Drive, Figma, Notion, GitHub…)" type="url" />
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional label" maxLength={120} />
        <Button type="submit" className="rounded-full gap-2" disabled={!url.trim() || adding}>
          <LinkIcon className="h-4 w-4" /> {adding ? "Adding…" : "Add"}
        </Button>
      </form>

      <p className="mt-2 text-[11px] text-ink-muted">
        Paste cloud links — direct file uploads ship next.
      </p>

      {isLoading ? (
        <div className="mt-6 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-ink-muted" />
        </div>
      ) : links.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-ink-muted">
          Nothing dropped yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {links.map((l) => {
            const kind = detectLinkKind(l.url);
            const KindIcon = kind.icon;
            return (
              <li key={l.id} className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-surface px-3 py-2.5 hover:border-border-strong transition">
                <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full", kind.bg)}>
                  <KindIcon className={cn("h-4 w-4", kind.color)} />
                </span>
                <div className="min-w-0 flex-1">
                  <a href={l.url} target="_blank" rel="noreferrer noopener" className="block truncate text-sm font-medium text-ink hover:underline">
                    {l.title || l.url}
                  </a>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">{kind.label}</span>
                </div>
                <a href={l.url} target="_blank" rel="noreferrer noopener" className="text-ink-muted hover:text-ink" aria-label="Open">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {user?.id === l.added_by && (
                  <button
                    onClick={() => remove(l.id)}
                    className="opacity-0 transition group-hover:opacity-100 text-ink-muted hover:text-destructive"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
