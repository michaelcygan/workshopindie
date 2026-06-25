import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Pencil, Star, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { createGroup, updateGroup, deleteGroup, seedGroupMembers, setGroupParent } from "@/lib/group-admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/groups")({ component: AdminGroups });

type GroupRow = {
  id: string;
  slug: string;
  name: string;
  kind: "city" | "genre" | "micro" | "scene";
  member_count: number;
  workshop_count: number;
  collab_count: number;
  work_count: number;
  is_official: boolean;
  featured_at: string | null;
  visibility: "public" | "unlisted";
  tagline: string | null;
  description: string | null;
  cover_url: string | null;
  parent_group_id: string | null;
};

function AdminGroups() {
  const qc = useQueryClient();
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["admin-groups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("groups")
        .select("id,slug,name,kind,member_count,workshop_count,collab_count,work_count,is_official,featured_at,visibility,tagline,description,cover_url,parent_group_id,deleted_at")
        .is("deleted_at", null)
        .order("kind")
        .order("name");
      return (data ?? []) as unknown as GroupRow[];
    },
  });

  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return groups;
    return groups.filter(
      (g) => g.name.toLowerCase().includes(s) || g.slug.toLowerCase().includes(s),
    );
  }, [groups, q]);

  const updateFn = useServerFn(updateGroup);
  const deleteFn = useServerFn(deleteGroup);

  const toggleFeatured = useMutation({
    mutationFn: (g: GroupRow) => updateFn({ data: { id: g.id, featured: !g.featured_at } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-groups"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
      toast("Group archived");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search groups"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm rounded-full"
        />
        <CreateGroupDialog />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-ink-muted">
            <tr>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Members</th>
              <th className="px-3 py-2">Counts</th>
              <th className="px-3 py-2">Featured</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-muted">Loading…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-muted">No groups.</td></tr>
            )}
            {filtered.map((g) => {
              const parent = g.parent_group_id
                ? groups.find((x) => x.id === g.parent_group_id) ?? null
                : null;
              return (
              <tr key={g.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <Link to="/g/$slug" params={{ slug: g.slug }} className="font-medium text-ink hover:underline">
                    {g.name}
                  </Link>
                  <div className="text-[11px] text-ink-muted">/{g.slug}</div>
                  {parent && (
                    <div className="mt-0.5 text-[11px] text-ink-muted">
                      ↳ in <span className="text-ink-soft">{parent.name}</span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 capitalize text-ink-soft">{g.kind}</td>
                <td className="px-3 py-2">{g.member_count}</td>
                <td className="px-3 py-2 text-ink-soft">{g.work_count} W · {g.collab_count} C · {g.workshop_count} S</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleFeatured.mutate(g)}
                    disabled={toggleFeatured.isPending}
                    className={g.featured_at ? "text-primary" : "text-ink-muted hover:text-ink"}
                    aria-label="Toggle featured"
                  >
                    <Star className={g.featured_at ? "h-4 w-4 fill-primary" : "h-4 w-4"} />
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <EditGroupDialog group={g} allGroups={groups} />
                    <SeedMembersDialog group={g} />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full"
                      onClick={() => {
                        if (confirm(`Archive "${g.name}"?`)) del.mutate(g.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateGroupDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState<"city" | "genre" | "micro" | "scene">("genre");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [featured, setFeatured] = useState(false);
  const qc = useQueryClient();
  const createFn = useServerFn(createGroup);

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          name,
          slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
          kind,
          tagline: tagline || null,
          description: description || null,
          cover_url: coverUrl || null,
          featured,
        },
      }),
    onSuccess: () => {
      toast.success("Group created");
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      setOpen(false);
      setName(""); setSlug(""); setTagline(""); setDescription(""); setCoverUrl(""); setFeatured(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full">Create Group</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Slug (URL)</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto from name" />
          </div>
          <div>
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="city">City</SelectItem>
                <SelectItem value="genre">Genre</SelectItem>
                <SelectItem value="micro">Micro</SelectItem>
                <SelectItem value="scene">Scene</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tagline</Label>
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={140} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
          <div>
            <Label>Cover image URL</Label>
            <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            Featured
          </label>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditGroupDialog({ group }: { group: GroupRow }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(group.name);
  const [tagline, setTagline] = useState(group.tagline ?? "");
  const [description, setDescription] = useState(group.description ?? "");
  const [coverUrl, setCoverUrl] = useState(group.cover_url ?? "");
  const [visibility, setVisibility] = useState<"public" | "unlisted">(group.visibility);
  const qc = useQueryClient();
  const updateFn = useServerFn(updateGroup);

  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id: group.id,
          name,
          tagline: tagline || null,
          description: description || null,
          cover_url: coverUrl || null,
          visibility,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
      qc.invalidateQueries({ queryKey: ["groups"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="rounded-full"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Group</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Tagline</Label><Input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={140} /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} /></div>
          <div><Label>Cover image URL</Label><Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} /></div>
          <div>
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as "public" | "unlisted")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="unlisted">Unlisted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SeedMembersDialog({ group }: { group: GroupRow }) {
  const [open, setOpen] = useState(false);
  const [handles, setHandles] = useState("");
  const qc = useQueryClient();
  const seedFn = useServerFn(seedGroupMembers);

  const seed = useMutation({
    mutationFn: async () => {
      const list = handles.split(/[\s,]+/).map((h) => h.trim().replace(/^@/, "")).filter(Boolean);
      if (list.length === 0) throw new Error("Enter at least one username");
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username")
        .in("username", list);
      const ids = (profs ?? []).map((p) => p.id as string);
      if (ids.length === 0) throw new Error("No matching users found");
      const res = await seedFn({ data: { group_id: group.id, user_ids: ids } });
      return { added: res.added, found: ids.length, requested: list.length };
    },
    onSuccess: (r) => {
      toast.success(`Added ${r.added} of ${r.requested} requested members`);
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
      qc.invalidateQueries({ queryKey: ["group", group.id] });
      setOpen(false);
      setHandles("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="rounded-full"><Users className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Seed members — {group.name}</DialogTitle></DialogHeader>
        <p className="text-xs text-ink-muted">Paste usernames separated by spaces or commas. They join as regular members.</p>
        <Textarea value={handles} onChange={(e) => setHandles(e.target.value)} rows={6} placeholder="@alice @bob carol …" />
        <DialogFooter>
          <Button onClick={() => seed.mutate()} disabled={seed.isPending}>
            {seed.isPending ? "Adding…" : "Add members"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
