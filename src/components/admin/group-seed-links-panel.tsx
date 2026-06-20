import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Loader2, Trash2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  createGroupSeedLink,
  listGroupSeedLinks,
  updateGroupSeedLink,
  deleteGroupSeedLink,
  searchGroupsForSeed,
} from "@/lib/group-seed-links.functions";

function buildUrl(slug: string, token: string) {
  if (typeof window === "undefined") return `/g/${slug}?j=${token}`;
  return `${window.location.origin}/g/${slug}?j=${token}`;
}

type GroupOption = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  accent_color: string | null;
  member_count: number;
};

export function GroupSeedLinksPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listGroupSeedLinks);
  const create = useServerFn(createGroupSeedLink);
  const update = useServerFn(updateGroupSeedLink);
  const del = useServerFn(deleteGroupSeedLink);
  const search = useServerFn(searchGroupsForSeed);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "group-seed-links"],
    queryFn: () => list(),
  });

  const [groupQuery, setGroupQuery] = useState("");
  const [selected, setSelected] = useState<GroupOption | null>(null);
  const [label, setLabel] = useState("");
  const [src, setSrc] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: groupResults } = useQuery({
    queryKey: ["admin", "group-seed-search", groupQuery],
    queryFn: () => search({ data: { q: groupQuery } }),
  });

  const reset = () => {
    setSelected(null); setLabel(""); setSrc(""); setMedium(""); setCampaign(""); setGroupQuery("");
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return toast.error("Pick a group");
    setCreating(true);
    try {
      const { link } = await create({
        data: {
          group_id: selected.id,
          label: label.trim() || null,
          utm_source: src.trim() || null,
          utm_medium: medium.trim() || null,
          utm_campaign: campaign.trim() || null,
        },
      });
      toast.success("Seed link created");
      await navigator.clipboard.writeText(buildUrl(selected.slug, link.token)).catch(() => {});
      reset();
      qc.invalidateQueries({ queryKey: ["admin", "group-seed-links"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create link");
    } finally {
      setCreating(false);
    }
  };

  const copy = async (slug: string, token: string) => {
    await navigator.clipboard.writeText(buildUrl(slug, token));
    toast.success("Link copied");
  };

  return (
    <section className="rounded-3xl border border-border bg-surface p-6 shadow-soft">
      <h2 className="font-display text-xl text-ink">Group seed links</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Shareable link for ads. Visitors land on the group page and are auto-joined after sign-up.
      </p>

      {/* Builder */}
      <form onSubmit={onCreate} className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label>Group</Label>
          {selected ? (
            <div className="flex items-center gap-2 rounded-full border border-border bg-background py-1.5 pl-2 pr-3">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: selected.accent_color ?? "#c2410c" }}
              />
              <span className="font-medium text-ink">{selected.name}</span>
              <span className="text-xs text-ink-muted">/{selected.slug} · {selected.member_count}</span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="ml-auto rounded-full px-2 py-0.5 text-xs text-ink-muted hover:bg-muted"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
                <Input
                  value={groupQuery}
                  onChange={(e) => setGroupQuery(e.target.value)}
                  placeholder="Search groups by name or slug"
                  className="pl-9"
                />
              </div>
              {(groupResults?.length ?? 0) > 0 && (
                <ul className="mt-1 max-h-56 overflow-auto rounded-2xl border border-border bg-background">
                  {groupResults!.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(g as GroupOption)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: g.accent_color ?? "#c2410c" }}
                        />
                        <span className="font-medium text-ink">{g.name}</span>
                        <span className="text-xs text-ink-muted">/{g.slug}</span>
                        <span className="ml-auto text-xs text-ink-muted">{g.member_count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gsl-label">Label (internal)</Label>
            <Input id="gsl-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Meta — NYC creators Mar" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gsl-campaign">Campaign</Label>
            <Input id="gsl-campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="utm_campaign" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gsl-src">Source</Label>
            <Input id="gsl-src" value={src} onChange={(e) => setSrc(e.target.value)} placeholder="utm_source (meta, tiktok…)" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gsl-medium">Medium</Label>
            <Input id="gsl-medium" value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="utm_medium (cpc, social…)" />
          </div>
        </div>

        <Button type="submit" disabled={creating || !selected} className="rounded-full gap-2">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create seed link
        </Button>
      </form>

      {/* List */}
      <div className="mt-8 border-t border-border pt-6">
        <h3 className="font-display text-base text-ink">Your seed links</h3>
        {isLoading ? (
          <div className="py-8 text-center text-ink-muted">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : (data?.links ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No seed links yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {data!.links.map((l: any) => {
              const slug = l.group?.slug ?? "";
              const url = buildUrl(slug, l.token);
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: l.group?.accent_color ?? "#c2410c" }}
                      />
                      <span className="font-medium text-ink">{l.group?.name ?? "(deleted group)"}</span>
                      {l.label && <Badge variant="outline" className="text-[10px]">{l.label}</Badge>}
                      {l.utm_source && <Badge variant="outline" className="text-[10px]">src: {l.utm_source}</Badge>}
                      {l.utm_campaign && <Badge variant="outline" className="text-[10px]">camp: {l.utm_campaign}</Badge>}
                    </div>
                    <div className="mt-1 truncate font-mono text-xs text-ink-muted">{url}</div>
                    <div className="mt-1 flex gap-3 text-[11px] text-ink-muted">
                      <span><b className="text-ink">{l.click_count}</b> clicks</span>
                      <span><b className="text-ink">{l.signup_count}</b> signups</span>
                      <span><b className="text-ink">{l.join_count}</b> joins</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                      Active
                      <Switch
                        checked={l.is_active}
                        onCheckedChange={async (checked) => {
                          try {
                            await update({ data: { id: l.id, patch: { is_active: checked } } });
                            qc.invalidateQueries({ queryKey: ["admin", "group-seed-links"] });
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Couldn't update");
                          }
                        }}
                      />
                    </div>
                    <Button size="sm" variant="outline" className="rounded-full gap-1" onClick={() => copy(slug, l.token)}>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full gap-1" asChild>
                      <a href={url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Open
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full text-rose-600 hover:bg-rose-50"
                      onClick={async () => {
                        if (!confirm("Delete this seed link? Past joins are kept.")) return;
                        try {
                          await del({ data: { id: l.id } });
                          qc.invalidateQueries({ queryKey: ["admin", "group-seed-links"] });
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Couldn't delete");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
