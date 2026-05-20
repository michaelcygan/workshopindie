import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/image-upload";
import { CATEGORIES, type Category, categoryClass } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { sanitizeInstagramHandle } from "@/lib/display-name";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/me/edit")({
  component: () => <RequireAuth><EditProfile /></RequireAuth>,
});

type Link = { label: string; url: string };

function EditProfile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [cityId, setCityId] = useState<string>("");
  const [cities, setCities] = useState<{ id: string; name: string; country: string }[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    supabase.from("cities").select("id,name,country").order("name").then(({ data }) => data && setCities(data));
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      const d = data as any;
      setDisplayName(data.display_name ?? "");
      setUsername(data.username ?? "");
      setFirstName(d.first_name ?? "");
      setLastName(d.last_name ?? "");
      setInstagram(d.instagram_handle ?? "");
      setHeadline(data.headline ?? "");
      setBio(data.bio ?? "");
      setAvatar(data.avatar_url ?? null);
      setCover(data.cover_url ?? null);
      setCats((data.categories ?? []) as Category[]);
      setLinks(((data.external_links as Link[] | null) ?? []));
      setCityId(data.city_id ?? "");
      setHydrated(true);
    });
  }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const ig = sanitizeInstagramHandle(instagram);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName,
      username: username || null,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      instagram_handle: ig || null,
      headline: headline || null,
      bio: bio || null,
      avatar_url: avatar,
      cover_url: cover,
      categories: cats,
      external_links: links.filter((l) => l.url),
      city_id: cityId || null,
      onboarded: true,
    } as any).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    if (username) navigate({ to: "/u/$username", params: { username } });
  }

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 py-20 text-ink-muted">Loading…</main>;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      <h1 className="font-display text-4xl text-ink">Edit profile</h1>
      <p className="mt-1 text-ink-muted">How you show up in the gallery and on Workshops.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-8">
        <section className="space-y-3">
          <Label>Cover image</Label>
          <ImageUpload value={cover} onChange={setCover} bucket="covers" aspect="wide" label="Upload cover (16:6)" />
        </section>

        <section className="grid grid-cols-[8rem,1fr] gap-5 items-start">
          <div>
            <Label className="mb-2 block">Avatar</Label>
            <ImageUpload value={avatar} onChange={setAvatar} bucket="avatars" aspect="square" label="Upload" />
          </div>
          <div className="space-y-3 pt-7">
            <div className="space-y-1.5">
              <Label htmlFor="dn">Display name</Label>
              <Input id="dn" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="un">Username</Label>
              <Input id="un" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="your-handle" />
              <p className="text-xs text-ink-muted">Pick a username when you're ready — this is your public @handle.</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="fn">First name</Label>
            <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ln">Last name</Label>
            <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <p className="col-span-2 -mt-1 text-xs text-ink-muted">
            Shown as first name + last initial (e.g. "{(firstName || "Jane").trim()} {(lastName.trim()[0] || "S").toUpperCase()}.") as a trust signal where helpful.
          </p>
        </section>

        <section className="space-y-1.5">
          <Label htmlFor="ig">Instagram <span className="text-ink-muted font-normal">(optional)</span></Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">@</span>
            <Input
              id="ig"
              value={instagram}
              onChange={(e) => setInstagram(sanitizeInstagramHandle(e.target.value))}
              placeholder="yourhandle"
              className="pl-7"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
        </section>

        <section className="space-y-1.5">
          <Label htmlFor="hl">Headline</Label>
          <Input id="hl" maxLength={120} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Director shooting on Super 8 in Brooklyn." />
        </section>

        <section className="space-y-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" rows={4} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} />
        </section>

        <section className="space-y-2">
          <Label>City</Label>
          <select value={cityId} onChange={(e) => setCityId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">— None —</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}, {c.country}</option>)}
          </select>
        </section>

        <section className="space-y-2">
          <Label>What you make</Label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button type="button" key={c.id}
                onClick={() => setCats((cur) => cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id])}
                className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                  cats.includes(c.id) ? cn("border-transparent", categoryClass(c.id)) : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                {c.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Links</Label>
            <Button type="button" size="sm" variant="ghost" className="rounded-full gap-1" onClick={() => setLinks((l) => [...l, { label: "", url: "" }])}>
              <Plus className="h-3.5 w-3.5" /> Add link
            </Button>
          </div>
          <div className="space-y-2">
            {links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Label" value={l.label} className="max-w-[10rem]" onChange={(e) => setLinks((arr) => arr.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <Input placeholder="https://…" value={l.url} onChange={(e) => setLinks((arr) => arr.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
                <Button type="button" variant="ghost" size="icon" onClick={() => setLinks((arr) => arr.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => navigate({ to: "/me" })}>Cancel</Button>
          <Button type="submit" disabled={saving} className="rounded-full">{saving ? "Saving…" : "Save profile"}</Button>
        </div>
      </form>
    </main>
  );
}
