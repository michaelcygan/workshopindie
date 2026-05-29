import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Plus, X, Globe2, CalendarClock, Sparkles, MinusCircle, Scale, Check, Copy } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { WORK_CATEGORIES, type Category, categoryClass } from "@/lib/categories";
import { CityCombobox, type CityValue } from "@/components/city-combobox";
import { TimelinePicker, type TimelineValue } from "@/components/timeline-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePlus, FREE_OPEN_COLLAB_CAP } from "@/hooks/use-plus";
import { PlusGate } from "@/components/plus-gate";
import { openWorkshopOnCollab } from "@/lib/collab-workshop.functions";
import { logShareEvent } from "@/lib/collab.functions";

export const Route = createFileRoute("/collab/new")({ component: NewCollab });

type LocationMode = "online" | "in_person" | "hybrid";
type CompType = "paid" | "unpaid" | "credit" | "negotiable" | "unspecified";
type ContactMode = "email_relay" | "external_link";
type WorkshopMode = "none" | "now" | "scheduled";
type RightsArrangement = "owner_retains" | "equal_split" | "creative_commons";
type RoleDraft = { role_name: string; quantity: number; description: string };

const RIGHTS_OPTIONS: { id: RightsArrangement; label: string; body: string }[] = [
  { id: "owner_retains", label: "Owner keeps publishing rights", body: "You retain the final say on how the work is released. Collaborators are credited." },
  { id: "equal_split", label: "Equal split among all participants", body: "Everyone who ships on this owns an equal share." },
  { id: "creative_commons", label: "Creative Commons", body: "Free for anyone to use with attribution (CC BY 4.0)." },
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
  film: ["Director", "DP", "Editor", "Actor", "Sound"],
  music: ["Vocalist", "Producer", "Mixer", "Instrumentalist", "Lyricist"],
  writing: ["Co-writer", "Editor", "Illustrator", "Reader"],
  build: ["Designer", "Engineer", "PM", "Researcher"],
  visual: ["Photographer", "Model", "Stylist", "Retoucher", "MUA"],
  critique: [],
  business: [],
  coworking: [],
};

function NewCollab() {
  const { user, loading } = useAuth();
  const { isPlus } = usePlus();
  const [plusGate, setPlusGate] = useState(false);
  const navigate = useNavigate();
  const openWorkshopFn = useServerFn(openWorkshopOnCollab);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("visual");
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
  const [workshopMode, setWorkshopMode] = useState<WorkshopMode>("none");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [rights, setRights] = useState<RightsArrangement | null>(null);
  const [rightsOpen, setRightsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    if (contactMode === "external_link" && !externalUrl.trim()) return toast.error("Add a link people can use to contact you");
    if (locationMode !== "online" && !city) return toast.error("Pick a city or set location to Remote");
    const cleanRoles = roles.filter((r) => r.role_name.trim() && r.quantity > 0);
    if (cleanRoles.length === 0) return toast.error("Add at least one role");

    if (workshopMode === "scheduled" && !scheduledAt) {
      return toast.error("Pick a date and time for the Workshop");
    }

    if (!isPlus) {
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
      status: "open",
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

    // Workshop pairing
    if (workshopMode === "scheduled") {
      const startsAt = new Date(scheduledAt);
      if (isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now()) {
        toast.error("Pick a future date & time — Collab posted without a scheduled Workshop.");
      } else {
        const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
        const { data: ws, error: wsErr } = await supabase
          .from("workshops")
          .insert({
            title: title.trim(),
            slug: "",
            category,
            host_user_id: user.id,
            mode: "scheduled",
            status: "open",
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            location_type: locationMode === "in_person" ? "in_person" : "online",
            city_id: city?.id ?? null,
            audience_city_ids: locationMode === "in_person" && city?.id
              ? [city.id, ...alsoCities.map((c) => c.id)]
              : [],
            participant_cap: 5,
            topic_collab_post_id: post.id,
            visibility: "public",
            prompt: `Working session for: ${title.trim()}`,
          })
          .select("id")
          .single();
        if (wsErr) {
          toast.error(`Collab posted, but couldn't schedule the Workshop: ${wsErr.message}`);
        } else if (ws) {
          await supabase.from("collab_posts").update({ live_workshop_id: ws.id }).eq("id", post.id);
        }
      }
      setSubmitting(false);
      toast.success("Collab posted. Your Workshop is on the calendar.");
      navigate({ to: "/collab/$slug", params: { slug: post.slug } });
      return;
    }

    if (workshopMode === "now") {
      try {
        const res = await openWorkshopFn({ data: { collabPostId: post.id } });
        setSubmitting(false);
        toast.success("Your Workshop is live — say hi.");
        navigate({ to: "/instant/$id", params: { id: res.roomId } });
        return;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't open the Workshop — your Collab is posted.");
        setSubmitting(false);
        navigate({ to: "/collab/$slug", params: { slug: post.slug } });
        return;
      }
    }

    setSubmitting(false);
    toast.success("Your Collab is live.");
    navigate({ to: "/collab/$slug", params: { slug: post.slug } });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl text-ink">Post a Collab</h1>
        <p className="mt-1 text-ink-muted">Share what you're making and the roles you need. People reach out — you pick your team.</p>
      </motion.div>

      <form onSubmit={onSubmit} className="mt-8 space-y-7">
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
                  category === c.id ? cn("border-transparent", categoryClass(c.id)) : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                {c.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-1.5">
          <Label htmlFor="desc">What's the idea</Label>
          <Textarea id="desc" rows={5} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="What you're making, the vibe, what's already done, and what 'great' looks like." />
        </section>

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
                  locationMode === t ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
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
                <div className="space-y-2 rounded-xl border border-dashed border-border bg-surface/40 p-3">
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
                        <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink">
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

        <section className="space-y-2">
          <Label>Pay</Label>
          <div className="flex flex-wrap gap-2">
            {COMP_OPTIONS.map((c) => (
              <button key={c.id} type="button" onClick={() => setComp(c.id)}
                className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                  comp === c.id ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                {c.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-muted">Set expectations up front — it makes better matches.</p>
        </section>

        <section className="space-y-2">
          <Label>How people contact you</Label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setContactMode("email_relay")}
              className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                contactMode === "email_relay" ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
              In-app message
            </button>
            <button type="button" onClick={() => setContactMode("external_link")}
              className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                contactMode === "external_link" ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
              External link
            </button>
          </div>
          {contactMode === "external_link" && (
            <Input className="mt-2" type="url" placeholder="https://… (your contact form, IG, email, etc.)"
              value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
          )}
        </section>

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
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-surface px-2.5 py-1 text-xs text-ink-soft hover:bg-muted hover:text-ink"
                >
                  <Plus className="h-3 w-3" /> {p}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-2">
            {roles.map((r, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-border bg-surface p-3">
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

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5"><Scale className="h-4 w-4 text-ink-muted" /> Rights <span className="text-xs font-normal text-ink-muted">(optional)</span></Label>
            {rights ? (
              <button type="button" onClick={() => { setRights(null); setRightsOpen(false); }} className="text-xs text-ink-muted hover:text-ink">Clear</button>
            ) : !rightsOpen ? (
              <button type="button" onClick={() => setRightsOpen(true)} className="text-xs text-ink-muted hover:text-ink">+ Add a rights note</button>
            ) : (
              <button type="button" onClick={() => setRightsOpen(false)} className="text-xs text-ink-muted hover:text-ink">Hide</button>
            )}
          </div>
          {(rightsOpen || rights) && (
            <div className="space-y-2 rounded-2xl border border-dashed border-border bg-surface/40 p-3">
              <p className="text-xs text-ink-muted">Set expectations now to avoid friction later.</p>
              {RIGHTS_OPTIONS.map((o) => (
                <label key={o.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border bg-background/60 p-3 transition", rights === o.id ? "border-ink shadow-sm" : "border-border hover:border-ink/40")}>
                  <input type="radio" name="rights" className="mt-1 accent-ink" checked={rights === o.id} onChange={() => setRights(o.id)} />
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-ink">{o.label}</span>
                    <span className="block text-xs text-ink-muted">{o.body}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-dashed border-border bg-surface/40 p-4">
          <div>
            <Label>Workshop on this Collab</Label>
            <p className="text-xs text-ink-muted">A Workshop is a live space of up to 5 — voice or video — for meeting collaborators, brainstorming the idea, and casting roles.</p>
          </div>

          <div className="space-y-2">
            <WorkshopOption
              selected={workshopMode === "none"}
              onClick={() => setWorkshopMode("none")}
              icon={<MinusCircle className="h-4 w-4" />}
              title="Not yet — just post it"
              body="Post the Collab on its own. You can open a Workshop on it any time."
            />
            <WorkshopOption
              selected={workshopMode === "now"}
              onClick={() => setWorkshopMode("now")}
              icon={<Sparkles className="h-4 w-4" />}
              title="Open a Workshop right now"
              body="Spin up a live Workshop the moment you post — meet collaborators, brainstorm the idea, and audition roles on the spot. Up to 5 seats."
            >
              {workshopMode === "now" && (
                <p className="rounded-lg bg-background/60 px-3 py-2 text-[11px] text-ink-muted">
                  After you post, we'll drop you straight into the Workshop.
                </p>
              )}
            </WorkshopOption>
            <WorkshopOption
              selected={workshopMode === "scheduled"}
              onClick={() => setWorkshopMode("scheduled")}
              icon={<CalendarClock className="h-4 w-4" />}
              title="Schedule a Workshop"
              body="Pick a date and time. Applicants get the invite and can RSVP. Everyone drops in when it starts."
            >
              {workshopMode === "scheduled" && (
                <div className="space-y-1.5">
                  <Label htmlFor="starts-at" className="text-xs text-ink-muted">When</Label>
                  <Input
                    id="starts-at"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    min={new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)}
                    required
                  />
                  <p className="text-[11px] text-ink-muted">If nobody shows in the first 15 minutes, the Workshop flips to drop-in mode. Nothing dies quietly.</p>
                </div>
              )}
            </WorkshopOption>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => navigate({ to: "/collab" })}>Cancel</Button>
          <Button type="submit" disabled={submitting} className="rounded-full">
            {submitting
              ? "Posting…"
              : workshopMode === "now"
                ? "Post & open Workshop"
                : workshopMode === "scheduled"
                  ? "Post & schedule Workshop"
                  : "Post Collab"}
          </Button>
        </div>
      </form>
      <PlusGate
        open={plusGate}
        onOpenChange={setPlusGate}
        title="You've hit 2 active Collabs"
        description="Free can run 2 open Collabs at a time. Go Plus for unlimited."
      />
    </main>
  );
}

function WorkshopOption({
  selected,
  onClick,
  icon,
  title,
  body,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-background/60 p-3 transition",
        selected ? "border-ink shadow-sm" : "border-border hover:border-ink/40",
      )}
    >
      <button type="button" onClick={onClick} className="flex w-full items-start gap-3 text-left">
        <span
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-ink bg-ink" : "border-border",
          )}
        >
          {selected && <span className="h-1.5 w-1.5 rounded-full bg-background" />}
        </span>
        <span className="flex-1 space-y-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
            {icon}
            {title}
          </span>
          <span className="block text-xs text-ink-muted">{body}</span>
        </span>
      </button>
      {children && <div className="mt-3 space-y-2 pl-7">{children}</div>}
    </div>
  );
}
