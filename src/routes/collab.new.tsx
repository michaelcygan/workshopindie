import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, X, Globe2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, type Category, categoryClass } from "@/lib/categories";
import { CityCombobox, type CityValue } from "@/components/city-combobox";
import { TimelinePicker, type TimelineValue } from "@/components/timeline-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePlus, FREE_OPEN_COLLAB_CAP } from "@/hooks/use-plus";
import { PlusGate } from "@/components/plus-gate";

export const Route = createFileRoute("/collab/new")({ component: NewCollab });

type LocationMode = "online" | "in_person" | "hybrid";
type CompType = "paid" | "unpaid" | "credit" | "negotiable" | "unspecified";
type ContactMode = "email_relay" | "external_link";
type RoleDraft = { role_name: string; quantity: number; description: string };

const COMP_OPTIONS: { id: CompType; label: string }[] = [
  { id: "paid", label: "Paid" },
  { id: "credit", label: "Credit only" },
  { id: "negotiable", label: "Negotiable" },
  { id: "unpaid", label: "Unpaid / passion" },
  { id: "unspecified", label: "Not specified" },
];

function NewCollab() {
  const { user, loading } = useAuth();
  const { isPlus } = usePlus();
  const [plusGate, setPlusGate] = useState(false);
  const navigate = useNavigate();

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
    { role_name: "Collaborator", quantity: 1, description: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  // When user adds an "also" city, append + reset
  useEffect(() => {
    if (!pendingAlso) return;
    if (city?.id === pendingAlso.id) { setPendingAlso(null); return; }
    if (alsoCities.some((c) => c.id === pendingAlso.id)) { setPendingAlso(null); return; }
    if (alsoCities.length >= 4) { toast.error("Up to 4 additional cities"); setPendingAlso(null); return; }
    setAlsoCities((cs) => [...cs, pendingAlso]);
    setPendingAlso(null);
  }, [pendingAlso, alsoCities, city]);

  function updateRole(i: number, patch: Partial<RoleDraft>) {
    setRoles((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRole(i: number) { setRoles((rs) => rs.filter((_, idx) => idx !== i)); }
  function addRole() { setRoles((rs) => [...rs, { role_name: "", quantity: 1, description: "" }]); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) return toast.error("Give your post a title");
    if (contactMode === "external_link" && !externalUrl.trim()) return toast.error("Add a link people can use to contact you");
    if (locationMode !== "online" && !city) return toast.error("Pick a city or set location to Online");
    const cleanRoles = roles.filter((r) => r.role_name.trim() && r.quantity > 0);
    if (cleanRoles.length === 0) return toast.error("Add at least one role");

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

    setSubmitting(false);
    toast.success("Posted to the Collab Board");
    navigate({ to: "/collab/$slug", params: { slug: post.slug } });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl text-ink">Post a call</h1>
        <p className="mt-1 text-ink-muted">Describe the idea and the roles you need. People reach out, you decide who's in.</p>
      </motion.div>

      <form onSubmit={onSubmit} className="mt-8 space-y-7">
        <section className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" required maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Looking for a vocalist for a moody synthwave EP" />
        </section>

        <section className="space-y-2">
          <Label>Category</Label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
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
            placeholder="What are you making? What's the vibe? What's already done? What does success look like?" />
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
                className={cn("rounded-full border px-3 py-1.5 text-sm capitalize transition",
                  locationMode === t ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                {t.replace("_", " ")}
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
          <Label>Compensation</Label>
          <div className="flex flex-wrap gap-2">
            {COMP_OPTIONS.map((c) => (
              <button key={c.id} type="button" onClick={() => setComp(c.id)}
                className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                  comp === c.id ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                {c.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <Label>How should people reach you</Label>
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
            <Button type="button" size="sm" variant="ghost" className="rounded-full gap-1" onClick={addRole}>
              <Plus className="h-3.5 w-3.5" /> Add role
            </Button>
          </div>
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

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => navigate({ to: "/collab" })}>Cancel</Button>
          <Button type="submit" disabled={submitting} className="rounded-full">
            {submitting ? "Posting…" : "Post call"}
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
