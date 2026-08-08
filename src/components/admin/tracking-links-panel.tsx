import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  createTrackingLink,
  listTrackingLinks,
  updateTrackingLink,
} from "@/lib/tracking-links.functions";
import {
  isValidTrackingSlug,
  normalizeDestination,
  slugifyTrackingLink,
  trackingLinkUrl,
  TRACKING_LINK_NAME_MAX,
} from "@/lib/tracking-links.shared";

export const TRACKING_LINKS_QUERY_KEY = ["admin", "tracking-links"] as const;

export type TrackingLinkRow = {
  id: string;
  slug: string;
  name: string;
  destination_path: string;
  is_active: boolean;
  created_at: string;
  total_clicks: number;
  member_clicks: number;
  guest_clicks: number;
  clicks_7d: number;
  last_click_at: string | null;
};

/**
 * Tracking link builder.
 *
 * A third, self-contained panel on /admin/links. It shares nothing with the
 * Workshop-room link builder or the group seed links above it: different
 * table, different route, different purpose (attribution, not joining).
 */
export function TrackingLinksPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listTrackingLinks);
  const create = useServerFn(createTrackingLink);
  const update = useServerFn(updateTrackingLink);

  const { data, isLoading, isError } = useQuery({
    queryKey: TRACKING_LINKS_QUERY_KEY,
    queryFn: () => list(),
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [destination, setDestination] = useState("");

  const effectiveSlug = slugTouched ? slugifyTrackingLink(slug) : slugifyTrackingLink(name);
  const destCheck = destination.trim() ? normalizeDestination(destination) : null;

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await create({ data: { name, destination, slug: effectiveSlug } });
      return res.link as TrackingLinkRow;
    },
    onSuccess: async (link) => {
      toast.success("Tracking link created", { description: `/go/${link.slug}` });
      await navigator.clipboard.writeText(trackingLinkUrl(link.slug)).catch(() => {});
      setName(""); setSlug(""); setSlugTouched(false); setDestination("");
      qc.invalidateQueries({ queryKey: TRACKING_LINKS_QUERY_KEY });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't create link"),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) =>
      update({ data: { id: v.id, patch: { is_active: v.is_active } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TRACKING_LINKS_QUERY_KEY }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update link"),
  });

  const links = useMemo(() => (data?.links ?? []) as TrackingLinkRow[], [data]);

  const canCreate =
    name.trim().length > 0 && isValidTrackingSlug(effectiveSlug) && destCheck?.ok === true;

  const copy = async (s: string) => {
    await navigator.clipboard.writeText(trackingLinkUrl(s));
    toast.success("Link copied");
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-ink">Tracking links</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Named Workshop URLs for posters, QR codes, NFC cards and bios. Each one redirects
            straight to a Workshop page and records whether the visitor was a member or new.
          </p>
        </div>
      </div>

      {/* Builder */}
      <form
        className="mt-5 grid gap-4 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (canCreate) createMut.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="tl-name">Name</Label>
          <Input
            id="tl-name"
            value={name}
            maxLength={TRACKING_LINK_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            placeholder="Empty Bottle poster — Aug"
          />
          <p className="text-xs text-ink-muted">Where you're putting it. Internal only.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tl-dest">Destination</Label>
          <Input
            id="tl-dest"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="/g/chicago or /events"
          />
          <p className={`text-xs ${destCheck && !destCheck.ok ? "text-destructive" : "text-ink-muted"}`}>
            {destCheck && !destCheck.ok
              ? destCheck.message
              : destCheck?.ok
                ? `Sends to ${destCheck.path}`
                : "A Workshop page path or full Workshop URL."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tl-slug">Link slug</Label>
          <Input
            id="tl-slug"
            value={slugTouched ? slug : effectiveSlug}
            onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
            placeholder="empty-bottle-poster"
          />
          <p className="text-xs text-ink-muted">
            {effectiveSlug ? `/go/${effectiveSlug}` : "Generated from the name."}
          </p>
        </div>

        <div className="md:col-span-3">
          <Button type="submit" disabled={!canCreate || createMut.isPending} className="gap-2 rounded-md">
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create tracking link
          </Button>
        </div>
      </form>

      {/* List */}
      <div className="mt-6 border-t border-border pt-5">
        {isLoading ? (
          <div className="py-8 text-center text-ink-muted"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : isError ? (
          <p className="py-6 text-sm text-destructive">Couldn't load tracking links.</p>
        ) : links.length === 0 ? (
          <p className="py-6 text-sm text-ink-muted">No tracking links yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink">{l.name}</span>
                    {!l.is_active && <Badge variant="secondary">Off</Badge>}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-xs text-ink-muted">
                    /go/{l.slug} → {l.destination_path}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-ink-muted">
                  <span title="All-time visits"><strong className="text-ink">{l.total_clicks}</strong> visits</span>
                  <span title="Signed-in members"><strong className="text-ink">{l.member_clicks}</strong> members</span>
                  <span title="Logged-out visitors"><strong className="text-ink">{l.guest_clicks}</strong> new</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => copy(l.slug)} aria-label="Copy link">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <a
                    href={`/go/${l.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-muted"
                    aria-label="Open link"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <Switch
                    checked={l.is_active}
                    onCheckedChange={(v) => toggleMut.mutate({ id: l.id, is_active: v })}
                    aria-label="Active"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
