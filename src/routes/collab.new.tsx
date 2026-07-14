import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Plus, X, Globe2, Scale, Check, Copy } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { type Category, type WorkCategory } from "@/lib/categories";
import { CategoryMultiPicker } from "@/components/category-multi-picker";
import { CityCombobox, type CityValue } from "@/components/city-combobox";
import { TimelinePicker, type TimelineValue } from "@/components/timeline-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePlus, FREE_OPEN_COLLAB_CAP } from "@/hooks/use-plus";
import { PlusGate } from "@/components/plus-gate";
// Workshop pairing on Collab creation is retired — every Collab gets a private Lounge.
import { logShareEvent } from "@/lib/collab.functions";
import { GroupPicker, usePreselectGroup, type PickerGroup } from "@/components/group-picker";
import { tagCollabInGroup } from "@/lib/groups.functions";
import { pinCollab } from "@/lib/room-pins.functions";

export const Route = createFileRoute("/collab/new")({
  component: NewCollabRoute,
  validateSearch: z.object({
    group: z.string().optional(),
    fromLounge: z.string().uuid().optional(),
  }),
});

function NewCollabRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  return (
    <CollabComposer
      groupPreselectId={search.group ?? null}
      fromLounge={search.fromLounge ?? null}
      onCancel={() => navigate({ to: "/collab" })}
      onPosted={(slug) => navigate({ to: "/collab/$slug", params: { slug } })}
      onDraftSaved={() => navigate({ to: "/me/collabs" })}
      onBackToLounge={(loungeId) =>
        navigate({ to: "/lounge/$id", params: { id: loungeId } })
      }
    />
  );
}

export type CollabComposerProps = {
  /** When present, the composer is mounted inside another surface (e.g. a Lounge dialog). */
  embed?: boolean;
  /** Group id to preselect on mount (from ?group=). */
  groupPreselectId?: string | null;
  /** Lounge id to auto-pin the resulting Collab to. */
  fromLounge?: string | null;
  onCancel?: () => void;
  onPosted?: (slug: string, id: string) => void;
  onDraftSaved?: () => void;
  onBackToLounge?: (loungeId: string) => void;
};


type LocationMode = "online" | "in_person" | "hybrid";
type CompType = "paid" | "unpaid" | "credit" | "negotiable" | "unspecified";
type ContactMode = "email_relay" | "external_link";

type RightsArrangement = "owner_retains" | "equal_split" | "creative_commons" | "decide_later";
type RoleDraft = { role_name: string; quantity: number; description: string };

const RIGHTS_OPTIONS: { id: RightsArrangement; label: string; body: string }[] = [
  { id: "decide_later", label: "Figure it out with collaborators", body: "Decide the arrangement together once the team comes together. Good for early-stage ideas." },
  { id: "creative_commons", label: "Creative Commons", body: "Free for anyone to use with attribution (CC BY 4.0)." },
  { id: "owner_retains", label: "Owner keeps publishing rights", body: "You retain the final say on how the work is released. Collaborators are credited." },
  { id: "equal_split", label: "Equal split among all participants", body: "Everyone who ships on this owns an equal share." },
];


const COMP_OPTIONS: { id: CompType; label: string }[] = [
  { id: "paid", label: "Paid" },
  { id: "credit", label: "Credit only" },
  { id: "negotiable", label: "Negotiable" },
  { id: "unpaid", label: "Unpaid / passion" },
  { id: "unspecified", label: "Not specified" },
];

const LOCATION_LABELS: Record<LocationMode, string> = {
  online: "Remote",
  in_person: "In person",
  hybrid: "Either",
};

const ROLE_PRESETS: Record<Category, string[]> = {
  film: ["Actor", "Director", "Cinematographer", "Editor", "Sound", "Producer", "Writer"],
  music: ["Vocalist", "Producer", "Instrumentalist", "Songwriter", "Mixer", "Featured artist"],
  writing: ["Co-writer", "Editor", "Beta reader", "Illustrator", "Researcher"],
  writing_book: ["Co-author", "Editor", "Beta reader", "Cover designer", "Illustrator", "Audiobook narrator"],
  build: ["Designer", "Engineer", "Product", "Researcher", "Co-founder"],
  visual: ["Photographer", "Model", "Stylist", "MUA", "Hair", "Art director", "Retoucher"],
  critique: ["Reader", "Reviewer", "Listener"],
  business: ["Co-founder", "Advisor", "Designer", "Engineer", "Marketer"],
  coworking: [],
  office_hours: [],
  roundtable: [],
  pitch: [],
  listen_party: [],
  open_mic: [],
  jam: [],
  standup: [],
};

export function CollabComposer({
  embed = false,
  groupPreselectId = null,
  fromLounge = null,
  onCancel,
  onPosted,
  onDraftSaved,
  onBackToLounge,
}: CollabComposerProps) {
  const { user, loading } = useAuth();
  const { isPlus } = usePlus();
  const [plusGate, setPlusGate] = useState(false);
  const navigate = useNavigate();

  const tagGroup = useServerFn(tagCollabInGroup);
  const pinToRoom = useServerFn(pinCollab);
  const preselect = usePreselectGroup(groupPreselectId ?? undefined);

  const [selectedGroups, setSelectedGroups] = useState<PickerGroup[]>([]);
  useEffect(() => {
    if (preselect.data && preselect.data.length > 0 && selectedGroups.length === 0) {
      setSelectedGroups(preselect.data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect.data]);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<WorkCategory>("visual");
  const [extraCategories, setExtraCategories] = useState<WorkCategory[]>([]);
  const [description, setDescription] = useState("");
  const [timeline, setTimeline] = useState<TimelineValue>({ mode: "flexible", starts_on: null, ends_on: null });
  const [timelineNote, setTimelineNote] = useState("");
  const [locationMode, setLocationMode] = useState<LocationMode>("online");
  const [city, setCity] = useState<CityValue | null>(null);
  const [showAlsoCities, setShowAlsoCities] = useState(false);
  const [alsoCities, setAlsoCities] = useState<CityValue[]>([]);
  const [pendingAlso, setPendingAlso] = useState<CityValue | null>(null);
  const [comp, setComp] = useState<CompType>("unspecified");
  const [contactMode, setContactMode] = useState<ContactMode>("email_relay");
  const [externalUrl, setExternalUrl] = useState("");
  const [roles, setRoles] = useState<RoleDraft[]>([
    { role_name: "", quantity: 1, description: "" },
  ]);
  const [rights, setRights] = useState<RightsArrangement>("decide_later");
  const [submitting, setSubmitting] = useState(false);
  const [postedDialog, setPostedDialog] = useState<{ id: string; slug: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveAsDraft, setSaveAsDraft] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!pendingAlso) return;
    if (city?.id === pendingAlso.id) { setPendingAlso(null); return; }
    if (alsoCities.some((c) => c.id === pendingAlso.id)) { setPendingAlso(null); return; }
    if (alsoCities.length >= 4) { toast.error("Up to 4 additional cities"); setPendingAlso(null); return; }
    setAlsoCities((cs) => [...cs, pendingAlso]);
    setPendingAlso(null);
  }, [pendingAlso, alsoCities, city]);

  const presetSuggestions = useMemo(() => {
    const taken = new Set(roles.map((r) => r.role_name.trim().toLowerCase()));
    return (ROLE_PRESETS[category] ?? []).filter((p) => !taken.has(p.toLowerCase()));
  }, [category, roles]);

  function updateRole(i: number, patch: Partial<RoleDraft>) {
    setRoles((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRole(i: number) { setRoles((rs) => rs.filter((_, idx) => idx !== i)); }
  function addRole(name = "") { setRoles((rs) => [...rs, { role_name: name, quantity: 1, description: "" }]); }
  function addPresetRole(name: string) {
    setRoles((rs) => {
      const firstEmpty = rs.findIndex((r) => !r.role_name.trim());
      if (firstEmpty >= 0) {
        return rs.map((r, i) => (i === firstEmpty ? { ...r, role_name: name } : r));
      }
      return [...rs, { role_name: name, quantity: 1, description: "" }];
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) return toast.error("Give your Collab a title");
    if (!description.trim()) return toast.error("Add a sentence on what's the idea");
    if (contactMode === "external_link" && !externalUrl.trim()) return toast.error("Add a link people can use to contact you");
    if (locationMode !== "online" && !city) return toast.error("Pick a city or set location to Remote");

    // Roles are optional now — if none, we create a single open-to-collaborators placeholder.
    let cleanRoles = roles.filter((r) => r.role_name.trim() && r.quantity > 0);
    if (cleanRoles.length === 0) {
      cleanRoles = [{ role_name: "Open to collaborators", quantity: 1, description: "" }];
    }

    const targetStatus: "draft" | "open" = saveAsDraft ? "draft" : "open";

    if (!isPlus && targetStatus === "open") {
      const { count } = await supabase
        .from("collab_posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "open");
      if ((count ?? 0) >= FREE_OPEN_COLLAB_CAP) {
        setPlusGate(true);
        return;
      }
    }

    setSubmitting(true);
    const { data: post, error } = await supabase.from("collab_posts").insert({
      title: title.trim(),
      slug: "",
      category,
      description: description || null,
      timeline_text: timelineNote.trim() || null,
      timeline_mode: timeline.mode,
      starts_on: timeline.starts_on,
      ends_on: timeline.ends_on,
      location_mode: locationMode,
      city_id: city?.id ?? null,
      also_cities: alsoCities.map((c) => c.id),
      compensation_type: comp,
      contact_mode: contactMode,
      external_contact_url: contactMode === "external_link" ? externalUrl.trim() : null,
      user_id: user.id,
      rights_arrangement: rights,
      status: targetStatus,
    }).select("id,slug").single();

    if (error || !post) { setSubmitting(false); return toast.error(error?.message ?? "Couldn't post"); }

    const { error: rolesErr } = await supabase.from("collab_roles").insert(
      cleanRoles.map((r, i) => ({
        collab_post_id: post.id,
        role_name: r.role_name.trim(),
        quantity: r.quantity,
        description: r.description || null,
        sort_order: i,
      })),
    );
    if (rolesErr) toast.error(rolesErr.message);

    // Tag into selected Groups (best-effort) — drafts skip tagging.
    if (targetStatus === "open" && selectedGroups.length > 0) {
      const results = await Promise.allSettled(
        selectedGroups.map((g) =>
          tagGroup({ data: { group_id: g.id, collab_post_id: post.id } }),
        ),
      );
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          toast.error(`Posted. Couldn't tag ${selectedGroups[i].name}, try from the group page.`);
        }
      });
    }

    // Auto-pin into the originating Lounge so the Collab appears in its Collabs tab.
    if (targetStatus === "open" && fromLounge) {
      try {
        await pinToRoom({ data: { roomId: fromLounge, collabPostId: post.id } });
      } catch (e) {
        toast.error(
          e instanceof Error ? `Posted, but couldn't pin to the Lounge: ${e.message}` : "Posted, but couldn't pin to the Lounge",
        );
      }
    }
    setSubmitting(false);


    if (targetStatus === "draft") {
      toast.success("Draft saved — find it in My Collabs.");
      onDraftSaved?.();
      return;
    }
    if (embed) {
      // Host surface (e.g. Lounge dialog) handles the "posted" UX.
      onPosted?.(post.slug, post.id);
      return;
    }
    setPostedDialog({ id: post.id, slug: post.slug });
  }


  const shareUrl = postedDialog
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/collab/${postedDialog.slug}`
    : "";

  async function copyShareLink() {
    if (!postedDialog) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast.success("Link copied — share away.");
      logShareEvent({ data: { collabPostId: postedDialog.id, channel: "copy" } }).catch(() => {});
    } catch {
      toast.error("Couldn't copy — long-press the link to copy it manually.");
    }
  }

  // Validation snapshots for progress dots + submit affordance.
  const pitchValid = title.trim().length > 0 && description.trim().length > 0;
  const shapeValid = locationMode === "online" || !!city;
  const teamValid = contactMode === "email_relay" || externalUrl.trim().length > 0;
  const allValid = pitchValid && shapeValid && teamValid;

  const dots: { ok: boolean; label: string }[] = [
    { ok: pitchValid, label: "The pitch" },
    { ok: shapeValid, label: "The shape" },
    { ok: teamValid, label: "The team" },
  ];


  return (
    <main className={cn(
      "mx-auto max-w-2xl px-4",
      embed ? "py-6 pb-6" : "py-10 pb-32 md:py-14 md:pb-32",
    )}>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl text-ink">Post a Collab</h1>
        <p className="mt-1 text-ink-muted">Share what you're making and the roles you need. People reach out — you pick your team.</p>
        <div className="mt-4 flex items-center gap-2" aria-label="Form progress">
          {dots.map((d, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-2 w-2 rounded-full transition",
                  d.ok ? "bg-ink" : "bg-border",
                )}
                aria-label={`${d.label} ${d.ok ? "complete" : "incomplete"}`}
              />
              <span className={cn("text-[11px]", d.ok ? "text-ink" : "text-ink-muted")}>{d.label}</span>
              {i < dots.length - 1 && <span className="mx-1 h-px w-4 bg-border" />}
            </div>
          ))}
        </div>
      </motion.div>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        {/* Card 1 — The pitch */}
        <div className="space-y-5 rounded-2xl border border-border bg-surface p-4 md:p-5">
          <section className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" required maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Looking for a vocalist for a moody synthwave EP" />
          </section>

          <section className="space-y-2">
            <Label>Medium</Label>
            <div className="flex flex-wrap gap-2">
              {WORK_CATEGORIES.map((c) => (
                <button type="button" key={c.id} onClick={() => setCategory(c.id)}
                  className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                    category === c.id ? cn("border-transparent", categoryClass(c.id)) : "border-border bg-background text-ink-soft hover:bg-muted")}>
                  {c.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="desc">What's the idea</Label>
            <Textarea id="desc" required rows={5} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Even a sentence works: ‘I want to make a short film this week.’ You can flesh it out later." />
            <p className="text-[11px] text-ink-muted">A line is fine. You can edit anytime.</p>
          </section>
        </div>

        {/* Card 2 — The shape */}
        <div className="space-y-5 rounded-2xl border border-border bg-surface p-4 md:p-5">
          <section className="space-y-2">
            <Label>Timeline</Label>
            <TimelinePicker value={timeline} onChange={setTimeline} />
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="tlnote" className="text-xs text-ink-muted">Anything else about timing? (optional)</Label>
              <Input id="tlnote" maxLength={120} value={timelineNote} onChange={(e) => setTimelineNote(e.target.value)} placeholder="Evenings only, async OK" />
            </div>
          </section>

          <section className="space-y-2">
            <Label>Where</Label>
            <div className="flex flex-wrap gap-2">
              {(["online", "in_person", "hybrid"] as LocationMode[]).map((t) => (
                <button key={t} type="button" onClick={() => setLocationMode(t)}
                  className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                    locationMode === t ? "border-transparent bg-ink text-background" : "border-border bg-background text-ink-soft hover:bg-muted")}>
                  {LOCATION_LABELS[t]}
                </button>
              ))}
            </div>
            {locationMode !== "online" && (
              <div className="space-y-2 pt-2">
                <Label className="text-xs text-ink-muted">Primary city</Label>
                <CityCombobox value={city} onChange={setCity} />

                {!showAlsoCities && alsoCities.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAlsoCities(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
                  >
                    <Globe2 className="h-3.5 w-3.5" /> + Open to other cities
                  </button>
                )}

                {(showAlsoCities || alsoCities.length > 0) && (
                  <div className="space-y-2 rounded-xl border border-dashed border-border bg-background/40 p-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-ink-muted">Also open to (up to 4)</Label>
                      {alsoCities.length === 0 && (
                        <button
                          type="button"
                          onClick={() => setShowAlsoCities(false)}
                          className="text-xs text-ink-muted hover:text-ink"
                        >
                          Hide
                        </button>
                      )}
                    </div>
                    {alsoCities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {alsoCities.map((c) => (
                          <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-ink">
                            {c.name}
                            <button
                              type="button"
                              onClick={() => setAlsoCities((cs) => cs.filter((x) => x.id !== c.id))}
                              className="text-ink-muted hover:text-ink"
                              aria-label={`Remove ${c.name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {alsoCities.length < 4 && (
                      <CityCombobox
                        value={null}
                        onChange={(v) => v && setPendingAlso(v)}
                        placeholder="Add another city"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <section className="space-y-2">
              <Label>Pay</Label>
              <div className="flex flex-wrap gap-2">
                {COMP_OPTIONS.map((c) => (
                  <button key={c.id} type="button" onClick={() => setComp(c.id)}
                    className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                      comp === c.id ? "border-transparent bg-ink text-background" : "border-border bg-background text-ink-soft hover:bg-muted")}>
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-ink-muted">Set expectations up front — better matches.</p>
            </section>

            <section className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-ink-muted" /> Rights
              </Label>
              <div className="space-y-1.5">
                {RIGHTS_OPTIONS.map((o) => (
                  <label
                    key={o.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-xl border bg-background/60 p-2.5 transition",
                      rights === o.id ? "border-ink shadow-sm" : "border-border hover:border-ink/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="rights"
                      className="mt-1 accent-ink"
                      checked={rights === o.id}
                      onChange={() => setRights(o.id)}
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-ink">{o.label}</span>
                      <span className="block text-[11px] text-ink-muted">{o.body}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Card 3 — The team */}
        <div className="space-y-5 rounded-2xl border border-border bg-surface p-4 md:p-5">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Roles you need</Label>
              <Button type="button" size="sm" variant="ghost" className="rounded-full gap-1" onClick={() => addRole()}>
                <Plus className="h-3.5 w-3.5" /> Add role
              </Button>
            </div>
            {presetSuggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-ink-muted">Quick add:</span>
                {presetSuggestions.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => addPresetRole(p)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-background px-2.5 py-1 text-xs text-ink-soft hover:bg-muted hover:text-ink"
                  >
                    <Plus className="h-3 w-3" /> {p}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {roles.map((r, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center gap-2">
                    <Input className="flex-1" placeholder="Role (e.g. Vocalist)" value={r.role_name} onChange={(e) => updateRole(i, { role_name: e.target.value })} />
                    <Input type="number" min={1} max={20} className="w-20" value={r.quantity} onChange={(e) => updateRole(i, { quantity: Math.max(1, Number(e.target.value)) })} />
                    <button type="button" onClick={() => removeRole(i)} className="rounded-full p-1.5 text-ink-muted hover:bg-muted">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <Textarea rows={2} placeholder="What you're looking for in this role (optional)" value={r.description} onChange={(e) => updateRole(i, { description: e.target.value })} />
                </div>
              ))}
            </div>
          </section>

          <GroupPicker value={selectedGroups} onChange={setSelectedGroups} max={3} />

          <section className="space-y-2">
            <Label>How people contact you</Label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setContactMode("email_relay")}
                className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                  contactMode === "email_relay" ? "border-transparent bg-ink text-background" : "border-border bg-background text-ink-soft hover:bg-muted")}>
                In-app message <span className="opacity-70">· recommended</span>
              </button>
              <button type="button" onClick={() => setContactMode("external_link")}
                className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                  contactMode === "external_link" ? "border-transparent bg-ink text-background" : "border-border bg-background text-ink-soft hover:bg-muted")}>
                External link
              </button>
            </div>
            <p className="text-[11px] text-ink-muted">In-app keeps your email private — applicants land in your inbox.</p>
            {contactMode === "external_link" && (
              <Input className="mt-2" type="url" placeholder="https://… (your contact form, IG, email, etc.)"
                value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
            )}
          </section>
        </div>

        {/* Every Collab gets a private Lounge automatically — accepted collaborators can open it from the Collab page. */}


        {/* Inline action bar — always visible on mobile, and on all sizes when embedded (dialog has no room for a fixed footer). */}
        <div className={cn(
          "flex flex-wrap justify-end gap-2",
          embed ? "" : "md:hidden",
        )}>
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => onCancel?.()}>Cancel</Button>
          <Button
            type="submit"
            variant="outline"
            disabled={submitting || !title.trim()}
            className="rounded-full"
            onClick={() => setSaveAsDraft(true)}
          >
            Save as draft
          </Button>
          <Button type="submit" disabled={submitting} className="rounded-full" onClick={() => setSaveAsDraft(false)}>
            {submitting && !saveAsDraft ? "Posting…" : "Post Collab"}
          </Button>
        </div>
      </form>

      {/* Desktop sticky action bar — hidden when embedded. */}
      <div className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur",
        embed ? "hidden" : "hidden md:block",
      )}>
        <div className="mx-auto max-w-2xl px-4">
          <div className="flex items-center justify-between gap-3 py-3">
            <p className="text-xs text-ink-muted">
              {allValid
                ? "All set — post, or save it as a draft to flesh out later."
                : !pitchValid
                  ? "Add a title and a sentence on the idea to continue."
                  : !shapeValid
                    ? "Pick a city or set location to Remote."
                    : "Add the contact link people should use."}
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" className="rounded-full" onClick={() => onCancel?.()}>Cancel</Button>
              <Button
                type="button"
                variant="outline"
                disabled={submitting || !title.trim()}
                className="rounded-full"
                onClick={() => {
                  setSaveAsDraft(true);
                  const form = document.querySelector("form");
                  if (form) form.requestSubmit();
                }}
              >
                {submitting && saveAsDraft ? "Saving…" : "Save as draft"}
              </Button>
              <Button
                type="button"
                disabled={submitting}
                variant={allValid ? "default" : "outline"}
                className="rounded-full"
                onClick={(e) => {
                  setSaveAsDraft(false);
                  const form = document.querySelector("form");
                  if (form) form.requestSubmit();
                  else onSubmit(e as unknown as React.FormEvent);
                }}
              >
                {submitting && !saveAsDraft ? "Posting…" : "Post Collab"}
              </Button>
            </div>
          </div>
          <p className="pb-2 text-[11px] text-ink-muted">
            What happens next:&nbsp;
            <span className="text-ink-soft">Post (or draft)</span>
            <span className="mx-1.5 opacity-50">→</span>
            <span className="text-ink-soft">Edit anytime</span>
            <span className="mx-1.5 opacity-50">→</span>
            <span className="text-ink-soft">People apply</span>
            <span className="mx-1.5 opacity-50">→</span>
            <span className="text-ink-soft">Publish a Work</span>
          </p>
        </div>
      </div>




      <PlusGate
        open={plusGate}
        onOpenChange={setPlusGate}
        title="You've hit 2 active Collabs"
        description="Free can run 2 open Collabs at a time. Go Plus for unlimited."
      />
      <Dialog open={!!postedDialog} onOpenChange={(o) => { if (!o) setPostedDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your Collab is live.</DialogTitle>
            <DialogDescription>
              It's open for applications, review, edits, and sharing. Anyone with the link can view it or apply — they don't need an account. Accepted collaborators can open this Collab's private Lounge from the Collab page whenever you want to meet live.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-1 space-y-1.5">
            <Label htmlFor="share-url" className="text-xs text-ink-muted">Shareable link</Label>
            <div className="flex items-center gap-2">
              <Input id="share-url" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} className="flex-1 text-xs" />
              <Button type="button" size="sm" variant="secondary" className="gap-1.5 rounded-full" onClick={copyShareLink}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-[11px] text-ink-muted">Drop it in IG stories, a group chat, or anywhere your people live.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => setPostedDialog(null)}>
              Stay here
            </Button>
            {fromLounge ? (
              <Button
                type="button"
                className="rounded-full"
                onClick={() => {
                  const lounge = fromLounge;
                  setPostedDialog(null);
                  onBackToLounge?.(lounge);
                }}
              >
                Back to the Lounge
              </Button>
            ) : (
              <Button
                type="button"
                className="rounded-full"
                onClick={() => {
                  const posted = postedDialog!;
                  setPostedDialog(null);
                  onPosted?.(posted.slug, posted.id);
                }}
              >
                Open Collab page
              </Button>
            )}
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </main>
  );
}
