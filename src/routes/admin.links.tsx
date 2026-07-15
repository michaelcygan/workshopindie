import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Loader2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CATEGORIES, type Category } from "@/lib/categories";
import { ImageUpload } from "@/components/image-upload";
import {
  createWorkshopLink,
  listWorkshopLinks,
  updateWorkshopLink,
  deleteWorkshopLink,
} from "@/lib/workshop-links.functions";
import { GroupSeedLinksPanel } from "@/components/admin/group-seed-links-panel";


export const Route = createFileRoute("/admin/links")({ component: AdminLinks });

function buildUrl(token: string) {
  if (typeof window === "undefined") return `/w/${token}`;
  return `${window.location.origin}/w/${token}`;
}

function AdminLinks() {
  const qc = useQueryClient();
  const list = useServerFn(listWorkshopLinks);
  const create = useServerFn(createWorkshopLink);
  const update = useServerFn(updateWorkshopLink);
  const del = useServerFn(deleteWorkshopLink);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "workshop-links"],
    queryFn: () => list(),
  });

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [cap, setCap] = useState(5);
  const [creating, setCreating] = useState(false);

  const resetForm = () => {
    setTitle(""); setPrompt(""); setCategory(""); setCoverUrl(null); setCap(5);
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title is required");
    setCreating(true);
    try {
      const { link } = await create({ data: {
        title: title.trim(),
        prompt: prompt.trim() || null,
        category: (category || null) as any,
        cover_url: coverUrl,
        participant_cap: cap,
      } });
      toast.success("Link created");
      await navigator.clipboard.writeText(buildUrl(link.token)).catch(() => {});
      resetForm();
      qc.invalidateQueries({ queryKey: ["admin", "workshop-links"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create link");
    } finally {
      setCreating(false);
    }
  };

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(buildUrl(token));
    toast.success("Link copied");
  };

  return (
    <div className="space-y-8">
      {/* Group seed links — auto-join Meta/ad traffic */}
      <GroupSeedLinksPanel />


      {/* Builder */}
      <section className="rounded-3xl border border-border bg-surface p-6 shadow-soft">
        <h2 className="font-display text-xl text-ink">New Workshop link</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Tap-to-join link for ads. Visitors land in a live Workshop spawned from this template; multiple instances can run in parallel.
        </p>
        <form onSubmit={onCreate} className="mt-5 grid gap-4 md:grid-cols-[1fr_220px]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wl-title">Workshop title</Label>
              <Input id="wl-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Songwriters' Critique — Thursday" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-prompt">Prompt / what to expect</Label>
              <Textarea id="wl-prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A short note that anchors the room…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wl-cat">Category</Label>
                <select
                  id="wl-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category | "")}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">None</option>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wl-cap">Seats per instance</Label>
                <Input id="wl-cap" type="number" min={2} max={12} value={cap} onChange={(e) => setCap(Math.max(2, Math.min(12, Number(e.target.value) || 5)))} />
              </div>
            </div>
            <Button type="submit" disabled={creating} className="rounded-full gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create link
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label>Cover image</Label>
            <ImageUpload value={coverUrl} onChange={setCoverUrl} bucket="covers" aspect="square" label="Add cover" />
          </div>
        </form>
      </section>

      {/* List */}
      <section className="rounded-3xl border border-border bg-surface p-6 shadow-soft">
        <h2 className="font-display text-xl text-ink">Your links</h2>
        {isLoading ? (
          <div className="py-10 text-center text-ink-muted">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : (data?.links ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No links yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {data!.links.map((l: any) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{l.title}</span>
                    {l.category && <Badge variant="outline" className="text-[10px] uppercase">{l.category}</Badge>}
                    {l.live_count > 0 && <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20">{l.live_count} live</Badge>}
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-ink-muted">{buildUrl(l.token)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                    Active
                    <Switch
                      checked={l.is_active}
                      onCheckedChange={async (checked) => {
                        try {
                          await update({ data: { id: l.id, patch: { is_active: checked } } });
                          qc.invalidateQueries({ queryKey: ["admin", "workshop-links"] });
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Couldn't update");
                        }
                      }}
                    />
                  </div>
                  <Button size="sm" variant="outline" className="rounded-full gap-1" onClick={() => copy(l.token)}>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full gap-1" asChild>
                    <a href={buildUrl(l.token)} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Open
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-rose-600 hover:bg-rose-50"
                    onClick={async () => {
                      if (!confirm("Delete this link? Live Workshops already spawned will continue.")) return;
                      try {
                        await del({ data: { id: l.id } });
                        qc.invalidateQueries({ queryKey: ["admin", "workshop-links"] });
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Couldn't delete");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
