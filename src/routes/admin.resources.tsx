import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TopicPicker, type PickerTopic } from "@/components/topics/topic-picker";
import { entityTopics, setEntityTopics } from "@/lib/topics.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, X, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { RESOURCE_CATEGORIES, resourceCategoryLabel, type ResourceRow } from "@/lib/resources/types";
import {
  listResourcesAdmin,
  createResource,
  updateResource,
  deleteResource,
  attachResourceToGroup,
  detachResourceFromGroup,
  reorderGroupResource,
} from "@/lib/resources.functions";

export const Route = createFileRoute("/admin/resources")({ component: AdminResources });

type Link = {
  id: string;
  group_id: string;
  resource_id: string;
  display_order: number;
  groups: { id: string; slug: string; name: string } | null;
};

const EMPTY = {
  name: "",
  category: "",
  useful_for: "",
  short_description: "",
  website_url: "",
  location_text: "",
  address: "",
  is_published: false,
};

function AdminResources() {
  const qc = useQueryClient();
  const list = useServerFn(listResourcesAdmin);
  const create = useServerFn(createResource);
  const update = useServerFn(updateResource);
  const del = useServerFn(deleteResource);
  const attach = useServerFn(attachResourceToGroup);
  const detach = useServerFn(detachResourceFromGroup);
  const reorder = useServerFn(reorderGroupResource);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "resources"],
    queryFn: () => list(),
  });

  const resources = (data?.resources ?? []) as ResourceRow[];
  const links = (data?.links ?? []) as unknown as Link[];

  const [form, setForm] = useState({ ...EMPTY });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "resources"] });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.useful_for ?? "").toLowerCase().includes(q) ||
        (r.location_text ?? "").toLowerCase().includes(q),
    );
  }, [resources, search]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Name is required");
    setCreating(true);
    try {
      await create({
        data: {
          name: form.name.trim(),
          category: (form.category || null) as any,
          useful_for: form.useful_for || null,
          short_description: form.short_description || null,
          website_url: form.website_url || null,
          location_text: form.location_text || null,
          address: form.address || null,
          is_published: form.is_published,
        },
      });
      toast.success("Resource created");
      setForm({ ...EMPTY });
      invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not create resource");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display text-xl text-ink">New resource</h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Central Camera"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="">No category</option>
              {RESOURCE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Useful for</Label>
            <Textarea
              rows={2}
              value={form.useful_for}
              onChange={(e) => setForm((f) => ({ ...f, useful_for: e.target.value }))}
              placeholder="35mm and medium-format film development and scanning."
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Short description</Label>
            <Textarea
              rows={2}
              value={form.short_description}
              onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input
              value={form.website_url}
              onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
              placeholder="https://"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input
              value={form.location_text}
              onChange={(e) => setForm((f) => ({ ...f, location_text: e.target.value }))}
              placeholder="Chicago, IL"
            />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <Switch
              checked={form.is_published}
              onCheckedChange={(v) => setForm((f) => ({ ...f, is_published: v }))}
            />
            <span className="text-sm text-ink-muted">Published</span>
            <Button type="submit" disabled={creating} className="ml-auto rounded-md">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create resource
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink">Resources</h2>
          <Input
            className="max-w-xs"
            placeholder="Search resources"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-ink-muted">No resources yet.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {filtered.map((r) => (
              <ResourceRowItem
                key={r.id}
                resource={r}
                links={links.filter((l) => l.resource_id === r.id)}
                onUpdate={async (patch) => {
                  await update({ data: { id: r.id, patch: patch as any } });
                  invalidate();
                }}
                onDelete={async () => {
                  if (!confirm(`Delete "${r.name}"?`)) return;
                  await del({ data: { id: r.id } });
                  toast.success("Deleted");
                  invalidate();
                }}
                onAttach={async (groupId) => {
                  await attach({ data: { resource_id: r.id, group_id: groupId } });
                  toast.success("Attached to group");
                  invalidate();
                }}
                onDetach={async (linkId) => {
                  await detach({ data: { link_id: linkId } });
                  invalidate();
                }}
                onReorder={async (linkId, order) => {
                  await reorder({ data: { link_id: linkId, display_order: order } });
                  invalidate();
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ResourceRowItem({
  resource,
  links,
  onUpdate,
  onDelete,
  onAttach,
  onDetach,
  onReorder,
}: {
  resource: ResourceRow;
  links: Link[];
  onUpdate: (patch: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
  onAttach: (groupId: string) => Promise<void>;
  onDetach: (linkId: string) => Promise<void>;
  onReorder: (linkId: string, order: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: resource.name,
    category: resource.category ?? "",
    useful_for: resource.useful_for ?? "",
    short_description: resource.short_description ?? "",
    website_url: resource.website_url ?? "",
    location_text: resource.location_text ?? "",
    address: resource.address ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [groupQuery, setGroupQuery] = useState("");
  const [topics, setTopics] = useState<PickerTopic[]>([]);
  const saveTopics = useServerFn(setEntityTopics);
  const loadTopics = useServerFn(entityTopics);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    loadTopics({ data: { kind: "resource", ids: [resource.id] } })
      .then((map) => {
        if (alive) setTopics((map as Record<string, PickerTopic[]>)[resource.id] ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resource.id]);

  const { data: groupResults = [] } = useQuery({
    queryKey: ["admin", "resources", "group-search", groupQuery],
    enabled: open && groupQuery.trim().length > 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("groups")
        .select("id,name,slug")
        .ilike("name", `%${groupQuery.trim()}%`)
        .is("deleted_at", null)
        .limit(10);
      return (data ?? []) as { id: string; name: string; slug: string }[];
    },
  });

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="text-left text-sm font-medium text-ink hover:underline"
          onClick={() => setOpen((v) => !v)}
        >
          {resource.name}
        </button>
        {resource.category && (
          <Badge variant="secondary">{resourceCategoryLabel(resource.category)}</Badge>
        )}
        <span className="text-xs text-ink-muted">
          {links.length} group{links.length === 1 ? "" : "s"}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={resource.is_published}
              onCheckedChange={(v) => onUpdate({ is_published: v })}
            />
            <span className="text-xs text-ink-muted">
              {resource.is_published ? "Published" : "Draft"}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete resource">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-5 rounded-md border border-border p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              >
                <option value="">No category</option>
                {RESOURCE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Useful for</Label>
              <Textarea
                rows={2}
                value={draft.useful_for}
                onChange={(e) => setDraft((d) => ({ ...d, useful_for: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Short description</Label>
              <Textarea
                rows={2}
                value={draft.short_description}
                onChange={(e) => setDraft((d) => ({ ...d, short_description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input
                value={draft.website_url}
                onChange={(e) => setDraft((d) => ({ ...d, website_url: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input
                value={draft.location_text}
                onChange={(e) => setDraft((d) => ({ ...d, location_text: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Address</Label>
              <Input
                value={draft.address}
                onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
              />
            </div>
          </div>
          <Button
            size="sm"
            className="rounded-md"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onUpdate({
                  name: draft.name.trim(),
                  category: draft.category || null,
                  useful_for: draft.useful_for || null,
                  short_description: draft.short_description || null,
                  website_url: draft.website_url || null,
                  location_text: draft.location_text || null,
                  address: draft.address || null,
                });
                toast.success("Saved");
              } catch (err: any) {
                toast.error(err?.message ?? "Could not save");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save
          </Button>

          <div className="border-t border-border pt-4">
            <TopicPicker
              value={topics}
              onChange={(next) => {
                setTopics(next);
                void saveTopics({
                  data: {
                    kind: "resource",
                    entityId: resource.id,
                    topicIds: next.map((t) => t.id),
                  },
                }).catch(() => toast.error("Topics didn't save."));
              }}
              max={5}
              helper="What is this resource about? Topics connect it across Workshop."
            />
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <Label>Groups</Label>
            {links.length > 0 && (
              <ul className="space-y-1.5">
                {links
                  .slice()
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((l, i, arr) => (
                    <li key={l.id} className="flex items-center gap-2 text-sm text-ink">
                      <span>{l.groups?.name ?? l.group_id}</span>
                      <span className="text-xs text-ink-muted">#{l.display_order}</span>
                      <div className="ml-auto flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={i === 0}
                          aria-label="Move up"
                          onClick={() => onReorder(l.id, Math.max(0, l.display_order - 1))}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={i === arr.length - 1}
                          aria-label="Move down"
                          onClick={() => onReorder(l.id, l.display_order + 1)}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Remove from group"
                          onClick={() => onDetach(l.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
            <Input
              placeholder="Search groups to attach…"
              value={groupQuery}
              onChange={(e) => setGroupQuery(e.target.value)}
            />
            {groupResults.length > 0 && (
              <ul className="space-y-1">
                {groupResults.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={async () => {
                        await onAttach(g.id);
                        setGroupQuery("");
                      }}
                    >
                      + {g.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
