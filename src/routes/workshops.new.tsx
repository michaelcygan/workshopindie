import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, type Category, categoryClass } from "@/lib/categories";
import { VenueSearch, type SelectedVenue } from "@/components/venue-search";
import { resolveVenueAndCity } from "@/lib/venues.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/workshops/new")({ component: NewWorkshop });

type LocationType = "online" | "in_person" | "hybrid";

type RoleDraft = { role_name: string; quantity: number };

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function NewWorkshop() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("visual");
  const [prompt, setPrompt] = useState("");
  const [locationType, setLocationType] = useState<LocationType>("online");
  const [locationText, setLocationText] = useState("");
  const [venue, setVenue] = useState<SelectedVenue | null>(null);
  const resolveVenue = useServerFn(resolveVenueAndCity);
  const [externalCallUrl, setExternalCallUrl] = useState("");
  const [cap, setCap] = useState<number | "">(8);

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(18, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow); tomorrowEnd.setHours(20, 0, 0, 0);
  const [startsAt, setStartsAt] = useState(toLocalInput(tomorrow));
  const [endsAt, setEndsAt] = useState(toLocalInput(tomorrowEnd));

  const [roles, setRoles] = useState<RoleDraft[]>([
    { role_name: "Director / Lead", quantity: 1 },
    { role_name: "Collaborator", quantity: 3 },
  ]);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  function updateRole(i: number, patch: Partial<RoleDraft>) {
    setRoles((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRole(i: number) { setRoles((rs) => rs.filter((_, idx) => idx !== i)); }
  function addRole() { setRoles((rs) => [...rs, { role_name: "", quantity: 1 }]); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) return toast.error("Give your Workshop a title");
    if (!startsAt || !endsAt) return toast.error("Set a start and end time");
    if (new Date(endsAt) <= new Date(startsAt)) return toast.error("End must be after start");
    if ((locationType === "in_person" || locationType === "hybrid") && !venue) {
      return toast.error("Pick a venue so people can find you");
    }

    const cleanRoles = roles.filter((r) => r.role_name.trim() && r.quantity > 0);
    if (cleanRoles.length === 0) return toast.error("Add at least one role");

    setSubmitting(true);
    const start = new Date(startsAt);
    const checkInOpens = new Date(start.getTime() - 15 * 60 * 1000);
    const checkInCloses = new Date(start.getTime() + 10 * 60 * 1000);
    const finalize = new Date(new Date(endsAt).getTime() + 24 * 60 * 60 * 1000);

    let venueFields: {
      city_id: string | null;
      venue_name: string | null;
      venue_address: string | null;
      venue_lat: number | null;
      venue_lng: number | null;
      venue_osm_ref: string | null;
      location_text: string | null;
    } = {
      city_id: null,
      venue_name: null,
      venue_address: null,
      venue_lat: null,
      venue_lng: null,
      venue_osm_ref: null,
      location_text: locationText || null,
    };

    if (venue) {
      try {
        const resolved = await resolveVenue({ data: venue });
        venueFields = {
          city_id: resolved.city_id,
          venue_name: resolved.venue_name,
          venue_address: resolved.venue_address,
          venue_lat: resolved.venue_lat,
          venue_lng: resolved.venue_lng,
          venue_osm_ref: resolved.venue_osm_ref,
          location_text: resolved.venue_name,
        };
      } catch (err) {
        setSubmitting(false);
        return toast.error(err instanceof Error ? err.message : "Couldn't resolve venue");
      }
    }

    const { data: ws, error } = await supabase.from("workshops").insert({
      title: title.trim(),
      slug: "",
      category,
      prompt: prompt || null,
      host_user_id: user.id,
      mode: "scheduled",
      visibility: "public",
      location_type: locationType,
      external_call_url: externalCallUrl || null,
      starts_at: start.toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      check_in_opens_at: checkInOpens.toISOString(),
      check_in_closes_at: checkInCloses.toISOString(),
      finalization_deadline_at: finalize.toISOString(),
      participant_cap: cap === "" ? null : Number(cap),
      status: "open",
      ...venueFields,
    }).select("id,slug").single();

    if (error || !ws) { setSubmitting(false); return toast.error(error?.message ?? "Couldn't create"); }

    // Insert roles
    const { error: rolesErr } = await supabase.from("workshop_roles").insert(
      cleanRoles.map((r, i) => ({ workshop_id: ws.id, role_name: r.role_name.trim(), quantity: r.quantity, sort_order: i })),
    );
    if (rolesErr) toast.error(rolesErr.message);

    // Add host as confirmed participant so they can post in the room
    await supabase.from("workshop_participants").insert({
      workshop_id: ws.id, user_id: user.id, participant_status: "confirmed",
    });

    setSubmitting(false);
    toast.success("Workshop scheduled");
    navigate({ to: "/workshops/$slug", params: { slug: ws.slug } });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl text-ink">Schedule a Workshop</h1>
        <p className="mt-1 text-ink-muted">Pick a category, set a clock, define roles. People will apply, you'll make the thing together, then ship it.</p>
      </motion.div>

      <form onSubmit={onSubmit} className="mt-8 space-y-7">
        <section className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" required maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A 2-hour film noir scene" />
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
          <Label htmlFor="prompt">Prompt</Label>
          <Textarea id="prompt" rows={4} maxLength={2000} value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder="What are we making? What's the constraint? What does 'done' look like?" />
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="starts">Starts</Label>
            <Input id="starts" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ends">Ends</Label>
            <Input id="ends" type="datetime-local" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </section>

        <section className="space-y-2">
          <Label>Where</Label>
          <div className="flex flex-wrap gap-2">
            {(["online", "in_person", "hybrid"] as LocationType[]).map((t) => (
              <button key={t} type="button" onClick={() => setLocationType(t)}
                className={cn("rounded-full border px-3 py-1.5 text-sm capitalize transition",
                  locationType === t ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                {t.replace("_", " ")}
              </button>
            ))}
          </div>
          {locationType !== "online" && (
            <Input className="mt-2" placeholder="Address or neighborhood" value={locationText} onChange={(e) => setLocationText(e.target.value)} />
          )}
          {locationType !== "in_person" && (
            <Input className="mt-2" type="url" placeholder="Call URL (Zoom, Meet, etc. — optional)" value={externalCallUrl} onChange={(e) => setExternalCallUrl(e.target.value)} />
          )}
        </section>

        <section className="space-y-1.5">
          <Label htmlFor="cap">Seat cap</Label>
          <Input id="cap" type="number" min={1} max={50} value={cap}
            onChange={(e) => setCap(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))} />
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Roles</Label>
            <Button type="button" size="sm" variant="ghost" className="rounded-full gap-1" onClick={addRole}>
              <Plus className="h-3.5 w-3.5" /> Add role
            </Button>
          </div>
          <div className="space-y-2">
            {roles.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2">
                <Input className="flex-1" placeholder="Role name (e.g. Cinematographer)" value={r.role_name} onChange={(e) => updateRole(i, { role_name: e.target.value })} />
                <Input type="number" min={1} max={20} className="w-20" value={r.quantity} onChange={(e) => updateRole(i, { quantity: Math.max(1, Number(e.target.value)) })} />
                <button type="button" onClick={() => removeRole(i)} className="rounded-full p-1.5 text-ink-muted hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => navigate({ to: "/workshops" })}>Cancel</Button>
          <Button type="submit" disabled={submitting} className="rounded-full">
            {submitting ? "Scheduling…" : "Publish Workshop"}
          </Button>
        </div>
      </form>
    </main>
  );
}
