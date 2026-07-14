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
import { CoverImagePicker } from "@/components/cover-image-picker";
import { type Category, categoryClass } from "@/lib/categories";
import {
  WORK_MEDIUMS,
  EXTRA_MEDIUMS,
  
  isExtraMedium,
  MAX_TOOLS,
  MAX_TOOL_LEN,
  type ExtraMedium,
} from "@/lib/mediums";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, X, User, Sparkles, MapPin, Link2, Pin } from "lucide-react";
import { sanitizeInstagramHandle } from "@/lib/display-name";
import { RequireAuth } from "@/components/require-auth";
import { PinnedWorksPicker, type PinnableWork } from "@/components/pinned-works-picker";
import { getMyAgeFields, setMyBirthdate, setMyAgeFilter } from "@/lib/profile-age.functions";

export const Route = createFileRoute("/me/edit")({
  component: () => <RequireAuth><EditProfile /></RequireAuth>,
});

type ExtLink = { label: string; url: string };

type SectionId = "identity" | "mediums" | "location" | "links" | "pinned";
const SECTIONS: { id: SectionId; label: string; icon: typeof User }[] = [
  { id: "identity", label: "Identity", icon: User },
  { id: "mediums", label: "Mediums & bio", icon: Sparkles },
  { id: "location", label: "Location", icon: MapPin },
  { id: "links", label: "Links", icon: Link2 },
  { id: "pinned", label: "Pinned pieces", icon: Pin },
];

type FormState = {
  username: string;
  firstName: string;
  lastName: string;
  aliases: string[];
  instagram: string;
  headline: string;
  bio: string;
  artistStatement: string;
  avatar: string | null;
  cover: string | null;
  cats: Category[];
  mediums: ExtraMedium[];
  tools: string[];
  links: ExtLink[];
  cityId: string;
  pinnedIds: string[];
  ageFilterMin: number | null;     // private: 18 / 21 / null
};

const EMPTY: FormState = {
  username: "",
  firstName: "", lastName: "", aliases: [], instagram: "",
  headline: "", bio: "", artistStatement: "", avatar: null, cover: null, cats: [], mediums: [], tools: [], links: [],
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
      const first = (data.first_name as string | null) ?? "";
      const last = (data.last_name as string | null) ?? "";
      const loaded: FormState = {
        username: data.username ?? "",
        firstName: first,
        lastName: last,
        aliases: ((data.aliases as string[] | null) ?? []),
        instagram: data.instagram_handle ?? "",
        headline: data.headline ?? "",
        bio: data.bio ?? "",
        artistStatement: (data as { artist_statement?: string | null }).artist_statement ?? "",
        avatar: data.avatar_url ?? null,
        cover: data.cover_url ?? null,
        cats: (data.categories ?? []) as Category[],
        mediums: ((data.mediums as string[] | null) ?? []).filter(isExtraMedium) as ExtraMedium[],
        tools: ((data.tools as string[] | null) ?? []),
        links: ((data.external_links as ExtLink[] | null) ?? []),
        cityId: data.city_id ?? "",
        pinnedIds: (data.pinned_work_ids ?? []) as string[],
        ageFilterMin: null,
      };
      setInitial(loaded);
      setForm(loaded);
      setHydrated(true);
    });

    fetchAge().then((r) => {
      setBirthdate(r.birthdate ?? "");
      setBirthdateLocked(r.locked);
      setInitial((prev) => ({ ...prev, ageFilterMin: r.ageFilterMin }));
      setForm((prev) => ({ ...prev, ageFilterMin: r.ageFilterMin }));
    }).catch(() => { /* ignore */ });
  }, [user, fetchAge]);

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
    const first = form.firstName.trim();
    const last = form.lastName.trim();
    if (!first || !last) {
      return toast.error("First and last name are required.");
    }
    setSaving(true);
    const ig = sanitizeInstagramHandle(form.instagram);
    const cleanPinned = form.pinnedIds.filter((id) => ownedWorks.some((w) => w.id === id)).slice(0, 6);
    const finalDisplay = `${first} ${last}`.trim();
    const seenAlias = new Set<string>();
    const cleanAliases = form.aliases
      .map((a) => a.trim())
      .filter((a) => {
        if (!a || a.length > 40) return false;
        const k = a.toLowerCase();
        if (seenAlias.has(k)) return false;
        seenAlias.add(k);
        return true;
      })
      .slice(0, 5);
    const { error } = await supabase.from("profiles").update({
      display_name: finalDisplay,
      username: form.username || null,
      first_name: first,
      last_name: last,
      aliases: cleanAliases,
      instagram_handle: ig || null,
      headline: form.headline || null,
      bio: form.bio || null,
      artist_statement: form.artistStatement.trim() || null,
      avatar_url: form.avatar,
      cover_url: form.cover,
      categories: form.cats,
      mediums: form.mediums,
      tools: form.tools,
      external_links: form.links.filter((l) => l.url),
      city_id: form.cityId || null,
      pinned_work_ids: cleanPinned,
      onboarded: true,
    }).eq("id", user.id);
    if (error) { setSaving(false); return toast.error(error.message); }

    // Age filter saves through a server fn (column is server-protected).
    if (form.ageFilterMin !== initial.ageFilterMin) {
      try {
        await saveAgeFilterFn({ data: { ageFilterMin: form.ageFilterMin } });
      } catch (err) {
        setSaving(false);
        return toast.error(err instanceof Error ? err.message : "Couldn't save age filter");
      }
    }

    setSaving(false);
    toast.success("Profile saved");
    setInitial({ ...form, pinnedIds: cleanPinned, instagram: ig });
    setForm((f) => ({ ...f, pinnedIds: cleanPinned, instagram: ig }));
  }

  async function onSaveBirthdate() {
    if (!birthdate) return toast.error("Please pick your date of birth.");
    setSavingBirthdate(true);
    try {
      await saveBirthdateFn({ data: { birthdate } });
      setBirthdateLocked(true);
      toast.success("Date of birth saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSavingBirthdate(false);
    }
  }

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 py-20 text-ink-muted">Loading…</main>;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-32 md:px-6 md:py-12">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink md:text-4xl">Edit profile</h1>
        <p className="mt-1 text-sm text-ink-muted">How you show up in the gallery, Lounges, and across the network.</p>
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
              <CoverImagePicker
                value={form.cover}
                onChange={(v) => set("cover", v)}
                works={ownedWorks.map((w) => ({ id: w.id, title: w.title, cover_url: w.cover_url }))}
                worksLoading={worksLoading}
              />
              <p className="text-xs text-ink-muted">Upload a wide image, or pick one from a Work you've published.</p>
            </div>

            <div className="flex gap-4 items-start">
              <div className="shrink-0">
                <Label className="mb-2 block">Profile picture</Label>
                <div className="h-20 w-20">
                  <ImageUpload value={form.avatar} onChange={(v) => set("avatar", v)} bucket="avatars" aspect="square" label="Upload" />
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-3 pt-7">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fn">First name</Label>
                    <Input id="fn" required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ln">Last name</Label>
                    <Input id="ln" required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-ink-muted">
                  Shown as "{(form.firstName || "Jane").trim()} {(form.lastName.trim()[0] || "S").toUpperCase()}." as a trust signal where it counts.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="un">Username</Label>
                  <Input id="un" value={form.username} onChange={(e) => set("username", e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="your-handle" />
                  <p className="text-xs text-ink-muted">Your public @handle — used in your profile URL.</p>
                </div>
              </div>
            </div>

            {/* Artist aliases (optional) */}
            <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="block">Artist aliases <span className="text-ink-muted font-normal">(optional)</span></Label>
                  <p className="text-xs text-ink-muted">Other names you go by — stage name, DJ name, real name. Shown as small chips on your profile. Up to 5.</p>
                </div>
                {form.aliases.length < 5 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="rounded-full gap-1 shrink-0"
                    onClick={() => set("aliases", [...form.aliases, ""])}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add alias
                  </Button>
                )}
              </div>
              {form.aliases.length > 0 && (
                <div className="space-y-2">
                  {form.aliases.map((a, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={a}
                        maxLength={40}
                        placeholder="e.g. DJ Nightowl"
                        onChange={(e) => set("aliases", form.aliases.map((x, j) => j === i ? e.target.value : x))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => set("aliases", form.aliases.filter((_, j) => j !== i))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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

            {/* Date of birth (private) */}
            <div className="space-y-1.5">
              <Label htmlFor="dob">Date of birth <span className="text-ink-muted font-normal">(private)</span></Label>
              <div className="flex items-center gap-2">
                <Input
                  id="dob"
                  type="date"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                  max={new Date(Date.now() - 13 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10)}
                  disabled={birthdateLocked}
                  className="max-w-[12rem]"
                />
                {!birthdateLocked && birthdate && (
                  <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={savingBirthdate} onClick={onSaveBirthdate}>
                    {savingBirthdate ? "Saving…" : "Save"}
                  </Button>
                )}
              </div>
              <p className="text-xs text-ink-muted">
                {birthdateLocked
                  ? "Locked. Contact support if this needs to change."
                  : "Never shown on your profile. Powers optional age filters for Lounges."}
              </p>
            </div>
          </Section>


          {/* MEDIUMS & BIO */}
          <Section id="mediums" title="Mediums & bio" subtitle="Drives your Gallery tabs, gallery filters, and which Lounges show up for you." refMap={sectionRefs}>
            <div className="space-y-2">
              <Label>Mediums</Label>
              <div className="flex flex-wrap gap-2">
                {WORK_MEDIUMS.map((c) => {
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
                {EXTRA_MEDIUMS.map((m) => {
                  const on = form.mediums.includes(m.id);
                  return (
                    <button type="button" key={m.id}
                      onClick={() => set("mediums", on ? form.mediums.filter((x) => x !== m.id) : [...form.mediums, m.id])}
                      className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                        on ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-ink-muted">Pick all that apply. Your Gallery tabs come from Film, Music, Writing, Build, and Visual — the rest just describe your practice.</p>
            </div>

            <ToolsField
              tools={form.tools}
              onChange={(next) => set("tools", next)}
            />

            <div className="space-y-1.5">
              <Label htmlFor="hl">Headline</Label>
              <Input id="hl" maxLength={120} value={form.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Director shooting on Super 8 in Brooklyn." />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" rows={5} maxLength={500} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
              <p className="text-right text-xs text-ink-muted">{form.bio.length}/500</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="artist-statement">Artist statement</Label>
              <Textarea
                id="artist-statement"
                rows={4}
                maxLength={1000}
                value={form.artistStatement}
                onChange={(e) => set("artistStatement", e.target.value)}
                placeholder="A short manifesto — what your practice is about. Sits above your Gallery. Leave blank to hide."
              />
              <p className="text-right text-xs text-ink-muted">{form.artistStatement.length}/1000</p>
            </div>
          </Section>


          {/* LOCATION */}
          <Section id="location" title="Location" subtitle="Helps us surface nearby Lounges and Meetups." refMap={sectionRefs}>
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
          <Section id="pinned" title="Pinned pieces" subtitle="Feature up to 6 of your published Works at the top of your profile." refMap={sectionRefs}>
            <PinnedWorksPicker
              works={ownedWorks}
              value={form.pinnedIds}
              onChange={(v) => set("pinnedIds", v)}
              loading={worksLoading}
            />
          </Section>

          <p className="px-1 pt-2 text-xs text-ink-muted">
            Looking for privacy, DMs, notifications, or blocked users? Those live in{" "}
            <a href="/settings" className="underline underline-offset-2 hover:text-ink">Settings</a>.
          </p>
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

function ToolsField({
  tools,
  onChange,
}: {
  tools: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const next = [...tools];
    const seen = new Set(next.map((t) => t.toLowerCase()));
    for (const piece of raw.split(",")) {
      const v = piece.trim().slice(0, MAX_TOOL_LEN);
      if (!v) continue;
      if (seen.has(v.toLowerCase())) continue;
      if (next.length >= MAX_TOOLS) break;
      next.push(v);
      seen.add(v.toLowerCase());
    }
    onChange(next);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="tools">What you use <span className="text-ink-muted">(optional)</span></Label>
      <div className="flex flex-wrap gap-1.5">
        {tools.map((t, i) => (
          <span key={`${t}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink">
            {t}
            <button
              type="button"
              aria-label={`Remove ${t}`}
              onClick={() => onChange(tools.filter((_, j) => j !== i))}
              className="text-ink-muted hover:text-ink"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        id="tools"
        value={draft}
        maxLength={MAX_TOOL_LEN}
        placeholder={tools.length >= MAX_TOOLS ? "Max reached" : "Camera, Telecaster, Loom, Kiln, Figma…"}
        disabled={tools.length >= MAX_TOOLS}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(",")) commit(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (draft.trim()) commit(draft);
          } else if (e.key === "Backspace" && !draft && tools.length > 0) {
            onChange(tools.slice(0, -1));
          }
        }}
        onBlur={() => { if (draft.trim()) commit(draft); }}
      />
      <p className="text-xs text-ink-muted">Cameras, instruments, software, looms, kilns — whatever you work with. Press Enter or comma to add. {tools.length}/{MAX_TOOLS}</p>
    </div>
  );
}

