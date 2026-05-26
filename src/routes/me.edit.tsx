import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { Plus, X, User, Sparkles, MapPin, Link2, Pin, Lock } from "lucide-react";
import { sanitizeInstagramHandle, deriveDisplayName } from "@/lib/display-name";
import { RequireAuth } from "@/components/require-auth";
import { PinnedWorksPicker, type PinnableWork } from "@/components/pinned-works-picker";
import { getMyAgeFields, setMyBirthdate, setMyAgeFilter } from "@/lib/profile-age.functions";

export const Route = createFileRoute("/me/edit")({
  component: () => <RequireAuth><EditProfile /></RequireAuth>,
});

type ExtLink = { label: string; url: string };

type SectionId = "identity" | "mediums" | "location" | "links" | "pinned" | "privacy";
const SECTIONS: { id: SectionId; label: string; icon: typeof User }[] = [
  { id: "identity", label: "Identity", icon: User },
  { id: "mediums", label: "Mediums & bio", icon: Sparkles },
  { id: "location", label: "Location", icon: MapPin },
  { id: "links", label: "Links", icon: Link2 },
  { id: "pinned", label: "Pinned works", icon: Pin },
  { id: "privacy", label: "Privacy", icon: Lock },
];

type FormState = {
  displayNameOverride: string;     // empty = use derived
  useDisplayOverride: boolean;
  username: string;
  firstName: string;
  lastName: string;
  instagram: string;
  headline: string;
  bio: string;
  avatar: string | null;
  cover: string | null;
  cats: Category[];
  links: ExtLink[];
  cityId: string;
  pinnedIds: string[];
  ageFilterMin: number | null;     // private: 18 / 21 / null
};

const EMPTY: FormState = {
  displayNameOverride: "", useDisplayOverride: false, username: "",
  firstName: "", lastName: "", instagram: "",
  headline: "", bio: "", avatar: null, cover: null, cats: [], links: [],
  cityId: "", pinnedIds: [], ageFilterMin: null,
};

function EditProfile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [initial, setInitial] = useState<FormState>(EMPTY);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [activeSection, setActiveSection] = useState<SectionId>("identity");
  const [birthdate, setBirthdate] = useState<string>("");      // YYYY-MM-DD
  const [birthdateLocked, setBirthdateLocked] = useState(false);
  const [savingBirthdate, setSavingBirthdate] = useState(false);

  const fetchAge = useServerFn(getMyAgeFields);
  const saveBirthdateFn = useServerFn(setMyBirthdate);
  const saveAgeFilterFn = useServerFn(setMyAgeFilter);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  const { data: cities = [] } = useQuery({
    queryKey: ["cities-all"],
    queryFn: async () => {
      const { data } = await supabase.from("cities").select("id,name,country").order("name");
      return (data ?? []) as { id: string; name: string; country: string }[];
    },
  });

  const { data: ownedWorks = [], isLoading: worksLoading } = useQuery({
    queryKey: ["me-owned-works", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("works")
        .select("id,title,slug,category,cover_url,published_at")
        .eq("created_by", user!.id)
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false });
      return (data ?? []) as PinnableWork[];
    },
  });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      const loaded: FormState = {
        displayName: data.display_name ?? "",
        username: data.username ?? "",
        firstName: data.first_name ?? "",
        lastName: data.last_name ?? "",
        instagram: data.instagram_handle ?? "",
        headline: data.headline ?? "",
        bio: data.bio ?? "",
        avatar: data.avatar_url ?? null,
        cover: data.cover_url ?? null,
        cats: (data.categories ?? []) as Category[],
        links: ((data.external_links as ExtLink[] | null) ?? []),
        cityId: data.city_id ?? "",
        pinnedIds: (data.pinned_work_ids ?? []) as string[],
      };
      setInitial(loaded);
      setForm(loaded);
      setHydrated(true);
    });
  }, [user]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);

  // Sticky sub-nav active section tracker.
  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({} as Record<SectionId, HTMLElement | null>);
  useEffect(() => {
    if (!hydrated) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveSection(visible[0].target.id as SectionId);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    SECTIONS.forEach((s) => {
      const el = sectionRefs.current[s.id];
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [hydrated]);

  const scrollTo = (id: SectionId) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
    setActiveSection(id);
  };

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!user) return;
    setSaving(true);
    const ig = sanitizeInstagramHandle(form.instagram);
    const cleanPinned = form.pinnedIds.filter((id) => ownedWorks.some((w) => w.id === id)).slice(0, 6);
    const { error } = await supabase.from("profiles").update({
      display_name: form.displayName,
      username: form.username || null,
      first_name: form.firstName.trim() || null,
      last_name: form.lastName.trim() || null,
      instagram_handle: ig || null,
      headline: form.headline || null,
      bio: form.bio || null,
      avatar_url: form.avatar,
      cover_url: form.cover,
      categories: form.cats,
      external_links: form.links.filter((l) => l.url),
      city_id: form.cityId || null,
      pinned_work_ids: cleanPinned,
      onboarded: true,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    setInitial({ ...form, pinnedIds: cleanPinned, instagram: ig });
    setForm((f) => ({ ...f, pinnedIds: cleanPinned, instagram: ig }));
  }

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 py-20 text-ink-muted">Loading…</main>;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-32 md:px-6 md:py-12">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink md:text-4xl">Edit profile</h1>
        <p className="mt-1 text-sm text-ink-muted">How you show up in the gallery, Workshops, and across the network.</p>
      </header>

      {/* Mobile sub-nav */}
      <nav className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-border bg-background/90 px-4 py-1 backdrop-blur md:hidden sticky top-0 z-20">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollTo(s.id)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition",
              activeSection === s.id ? "bg-ink text-background" : "text-ink-muted hover:bg-muted",
            )}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="grid gap-10 md:grid-cols-[14rem_1fr]">
        {/* Desktop sub-nav */}
        <aside className="hidden md:block">
          <nav className="sticky top-8 space-y-0.5">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollTo(s.id)}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                    active ? "bg-muted text-ink" : "text-ink-muted hover:bg-muted/60 hover:text-ink",
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-ink" : "text-ink-muted group-hover:text-ink")} />
                  {s.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <form onSubmit={onSubmit} className="min-w-0 space-y-12">
          {/* IDENTITY */}
          <Section id="identity" title="Identity" subtitle="Your face, your name, your handle." refMap={sectionRefs}>
            <div className="space-y-2">
              <Label>Cover image</Label>
              <div className="w-full max-w-xs">
                <ImageUpload value={form.cover} onChange={(v) => set("cover", v)} bucket="covers" aspect="wide" label="Upload cover (16:6)" />
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="shrink-0">
                <Label className="mb-2 block">Profile picture</Label>
                <div className="h-20 w-20">
                  <ImageUpload value={form.avatar} onChange={(v) => set("avatar", v)} bucket="avatars" aspect="square" label="Upload" />
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-3 pt-7">
                <div className="space-y-1.5">
                  <Label htmlFor="dn">Display name</Label>
                  <Input id="dn" required value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="un">Username</Label>
                  <Input id="un" value={form.username} onChange={(e) => set("username", e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="your-handle" />
                  <p className="text-xs text-ink-muted">Your public @handle — used in your profile URL.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fn">First name</Label>
                <Input id="fn" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ln">Last name</Label>
                <Input id="ln" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </div>
              <p className="col-span-2 -mt-1 text-xs text-ink-muted">
                Shown as "{(form.firstName || "Jane").trim()} {(form.lastName.trim()[0] || "S").toUpperCase()}." as a trust signal where it counts.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ig">Instagram <span className="text-ink-muted font-normal">(optional)</span></Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">@</span>
                <Input
                  id="ig"
                  value={form.instagram}
                  onChange={(e) => set("instagram", sanitizeInstagramHandle(e.target.value))}
                  placeholder="yourhandle"
                  className="pl-7"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            </div>
          </Section>

          {/* MEDIUMS & BIO */}
          <Section id="mediums" title="Mediums & bio" subtitle="Drives your Works tabs, gallery filters, and which Instant Workshops you see." refMap={sectionRefs}>
            <div className="space-y-2">
              <Label>What you make</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const on = form.cats.includes(c.id);
                  return (
                    <button type="button" key={c.id}
                      onClick={() => set("cats", on ? form.cats.filter((x) => x !== c.id) : [...form.cats, c.id])}
                      className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                        on ? cn("border-transparent", categoryClass(c.id)) : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-ink-muted">Multimedia artists: pick all that apply — your portfolio tabs by medium.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hl">Headline</Label>
              <Input id="hl" maxLength={120} value={form.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Director shooting on Super 8 in Brooklyn." />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" rows={5} maxLength={500} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
              <p className="text-right text-xs text-ink-muted">{form.bio.length}/500</p>
            </div>
          </Section>

          {/* LOCATION */}
          <Section id="location" title="Location" subtitle="Helps us surface nearby Workshops and Meetups." refMap={sectionRefs}>
            <div className="space-y-2">
              <Label>City</Label>
              <select value={form.cityId} onChange={(e) => set("cityId", e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                <option value="">— None —</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}, {c.country}</option>)}
              </select>
            </div>
          </Section>

          {/* LINKS */}
          <Section id="links" title="Links" subtitle="Portfolio, label, agency, anywhere else you live online." refMap={sectionRefs}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>External links</Label>
                <Button type="button" size="sm" variant="ghost" className="rounded-full gap-1" onClick={() => set("links", [...form.links, { label: "", url: "" }])}>
                  <Plus className="h-3.5 w-3.5" /> Add link
                </Button>
              </div>
              <div className="space-y-2">
                {form.links.length === 0 && (
                  <p className="text-sm text-ink-muted">No links yet.</p>
                )}
                {form.links.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="Label" value={l.label} className="max-w-[10rem]" onChange={(e) => set("links", form.links.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                    <Input placeholder="https://…" value={l.url} onChange={(e) => set("links", form.links.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => set("links", form.links.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* PINNED WORKS */}
          <Section id="pinned" title="Pinned works" subtitle="Feature up to 6 of your published Works at the top of your profile." refMap={sectionRefs}>
            <PinnedWorksPicker
              works={ownedWorks}
              value={form.pinnedIds}
              onChange={(v) => set("pinnedIds", v)}
              loading={worksLoading}
            />
          </Section>

          {/* PRIVACY */}
          <Section id="privacy" title="Privacy" subtitle="Control who sees what." refMap={sectionRefs}>
            <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-ink-muted">
              <p className="text-ink">Granular privacy controls are coming soon.</p>
              <p className="mt-1">You can already hide individual credits from your profile by opening that Work and toggling visibility per credit.</p>
            </div>
          </Section>
        </form>
      </div>

      {/* Sticky save bar */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur transition-transform",
          dirty ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <span className="text-sm text-ink-muted">Unsaved changes</span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => setForm(initial)} disabled={saving}>
              Discard
            </Button>
            <Button type="button" disabled={saving} className="rounded-full" onClick={() => onSubmit()}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({
  id, title, subtitle, children, refMap,
}: {
  id: SectionId;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  refMap: React.MutableRefObject<Record<SectionId, HTMLElement | null>>;
}) {
  return (
    <section
      id={id}
      ref={(el) => { refMap.current[id] = el; }}
      className="scroll-mt-24 space-y-5"
    >
      <div>
        <h2 className="font-display text-xl text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
