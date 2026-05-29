import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Globe2, MapPin, Zap, CalendarClock, Pin, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VenueSearch, type SelectedVenue } from "@/components/venue-search";
import { resolveVenueAndCity } from "@/lib/venues.functions";
import { ensureWorkshopRoom } from "@/lib/workshop-room.functions";
import { CATEGORIES, type Category, categoryClass } from "@/lib/categories";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type When = "now" | "scheduled";
type Where = "online" | "in_person";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  city: { id: string; name: string; slug: string };
  isAdmin: boolean;
  onPosted?: () => void;
};

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PostWorkshopFromCitySheet({ open, onOpenChange, city, isAdmin, onPosted }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const resolveVenue = useServerFn(resolveVenueAndCity);
  const ensureRoom = useServerFn(ensureWorkshopRoom);

  const [collabId, setCollabId] = useState<string | "">("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("visual");
  const [prompt, setPrompt] = useState("");
  const [when, setWhen] = useState<When>("now");
  const [where, setWhere] = useState<Where>("online");
  const [venue, setVenue] = useState<SelectedVenue | null>(null);
  const [externalCallUrl, setExternalCallUrl] = useState("");
  const [cap, setCap] = useState<number | "">(6);
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const tomorrow = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); return d; }, []);
  const tomorrowEnd = useMemo(() => { const d = new Date(tomorrow); d.setHours(20, 0, 0, 0); return d; }, [tomorrow]);
  const [startsAt, setStartsAt] = useState(toLocalInput(tomorrow));
  const [endsAt, setEndsAt] = useState(toLocalInput(tomorrowEnd));

  // Reset on close
  useEffect(() => {
    if (!open) {
      setCollabId(""); setTitle(""); setCategory("visual"); setPrompt("");
      setWhen("now"); setWhere("online"); setVenue(null); setExternalCallUrl("");
      setCap(6); setPinned(false); setSubmitting(false);
    }
  }, [open]);

  // Load my open Collabs to seed the Workshop from
  const { data: myCollabs = [] } = useQuery({
    queryKey: ["my-open-collabs", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data } = await supabase.from("collab_posts")
        .select("id,title,category,description,status,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  // When user picks a collab, prefill
  useEffect(() => {
    if (!collabId) return;
    const c = myCollabs.find((m: any) => m.id === collabId);
    if (!c) return;
    if (!title) setTitle(c.title);
    setCategory(c.category as Category);
    if (!prompt && c.description) setPrompt(c.description);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { toast.error("Sign in to post a Workshop"); return; }
    if (!title.trim()) return toast.error("Give your Workshop a title");
    if (where === "in_person" && !venue) return toast.error("Pick a venue in " + city.name);
    if (when === "scheduled") {
      if (!startsAt || !endsAt) return toast.error("Set a start and end time");
      if (new Date(endsAt) <= new Date(startsAt)) return toast.error("End must be after start");
    }

    setSubmitting(true);

    // IRL: resolve venue and check it's in this city
    let venueFields: {
      venue_name: string | null;
      venue_address: string | null;
      venue_lat: number | null;
      venue_lng: number | null;
      venue_osm_ref: string | null;
      location_text: string | null;
    } = { venue_name: null, venue_address: null, venue_lat: null, venue_lng: null, venue_osm_ref: null, location_text: null };

    if (where === "in_person" && venue) {
      try {
        const resolved = await resolveVenue({ data: venue });
        if (resolved.city_id !== city.id) {
          setSubmitting(false);
          return toast.error(`Venue is outside ${city.name}. Pick a venue in ${city.name} or switch to Online.`);
        }
        venueFields = {
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

    const now = new Date();
    const start = when === "now" ? now : new Date(startsAt);
    const end = when === "now" ? new Date(now.getTime() + 2 * 60 * 60 * 1000) : new Date(endsAt);
    const checkInOpens = new Date(start.getTime() - 15 * 60 * 1000);
    const checkInCloses = new Date(start.getTime() + 10 * 60 * 1000);
    const finalize = new Date(end.getTime() + 24 * 60 * 60 * 1000);

    const { data: ws, error } = await supabase.from("workshops").insert({
      title: title.trim(),
      slug: "",
      category,
      prompt: prompt || null,
      host_user_id: user.id,
      mode: when === "now" ? "instant_spawned" : "scheduled",
      visibility: "public",
      location_type: where,
      external_call_url: where === "online" ? (externalCallUrl || null) : null,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      check_in_opens_at: checkInOpens.toISOString(),
      check_in_closes_at: checkInCloses.toISOString(),
      finalization_deadline_at: finalize.toISOString(),
      participant_cap: cap === "" ? null : Number(cap),
      status: when === "now" ? "active" : "open",
      city_id: city.id,
      audience_city_ids: [city.id],
      topic_collab_post_id: collabId || null,
      is_pinned: isAdmin ? pinned : false,
      ...venueFields,
    }).select("id,slug").single();

    if (error || !ws) { setSubmitting(false); return toast.error(error?.message ?? "Couldn't post Workshop"); }

    // Insert a default role row so people can apply
    await supabase.from("workshop_roles").insert({
      workshop_id: ws.id, role_name: "Collaborator", quantity: cap === "" ? 5 : Math.max(1, Number(cap) - 1), sort_order: 0,
    });

    // Host as confirmed participant
    await supabase.from("workshop_participants").insert({
      workshop_id: ws.id, user_id: user.id, participant_status: "confirmed",
    });

    // Link from the Collab if chosen
    if (collabId) {
      await supabase.from("collab_posts").update({ live_workshop_id: ws.id }).eq("id", collabId).eq("user_id", user.id);
    }

    if (when === "now") {
      // Spawn paired room and dive in
      try {
        const { roomId } = await ensureRoom({ data: { workshopId: ws.id } });
        setSubmitting(false);
        onOpenChange(false);
        onPosted?.();
        toast.success("Workshop is live");
        navigate({ to: "/instant/$id", params: { id: roomId } });
        return;
      } catch (err) {
        setSubmitting(false);
        toast.error(err instanceof Error ? err.message : "Couldn't open the room");
        return;
      }
    }

    setSubmitting(false);
    onOpenChange(false);
    onPosted?.();
    toast.success(`Workshop posted in ${city.name}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Post a Workshop in {city.name}</DialogTitle>
          <DialogDescription>
            Only people in {city.name} will see it. Go live right now or schedule for later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5 pt-2">
          {/* From a Collab */}
          {myCollabs.length > 0 && (
            <section className="space-y-1.5">
              <Label className="inline-flex items-center gap-1.5 text-sm"><Sparkles className="h-3.5 w-3.5" /> Build from one of your Collabs (optional)</Label>
              <div className="flex flex-wrap gap-1.5">
                {myCollabs.map((c: any) => (
                  <button key={c.id} type="button"
                    onClick={() => setCollabId(collabId === c.id ? "" : c.id)}
                    className={cn("max-w-[18rem] truncate rounded-full border px-3 py-1 text-xs transition",
                      collabId === c.id ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                    {c.title}
                  </button>
                ))}
                {collabId && (
                  <button type="button" onClick={() => setCollabId("")} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-ink-muted hover:text-ink">
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Title */}
          <section className="space-y-1.5">
            <Label htmlFor="ws-title">Title <span className="text-destructive">*</span></Label>
            <Input id="ws-title" required maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A 2-hour film noir scene" />
          </section>

          {/* Category */}
          <section className="space-y-1.5">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button type="button" key={c.id} onClick={() => setCategory(c.id)}
                  className={cn("rounded-full border px-3 py-1 text-xs transition",
                    category === c.id ? cn("border-transparent", categoryClass(c.id)) : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                  {c.label}
                </button>
              ))}
            </div>
          </section>

          {/* When */}
          <section className="space-y-1.5">
            <Label>When <span className="text-destructive">*</span></Label>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setWhen("now")}
                className={cn("inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm transition",
                  when === "now" ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                <Zap className="h-4 w-4" /> Right now
              </button>
              <button type="button" onClick={() => setWhen("scheduled")}
                className={cn("inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm transition",
                  when === "scheduled" ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                <CalendarClock className="h-4 w-4" /> Schedule
              </button>
            </div>
            {when === "scheduled" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="starts" className="text-xs text-ink-muted">Starts</Label>
                  <Input id="starts" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ends" className="text-xs text-ink-muted">Ends</Label>
                  <Input id="ends" type="datetime-local" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                </div>
              </div>
            )}
          </section>

          {/* Where */}
          <section className="space-y-1.5">
            <Label>Where <span className="text-destructive">*</span></Label>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setWhere("online")}
                className={cn("inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm transition",
                  where === "online" ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                <Globe2 className="h-4 w-4" /> Online
              </button>
              <button type="button" onClick={() => setWhere("in_person")}
                className={cn("inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm transition",
                  where === "in_person" ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                <MapPin className="h-4 w-4" /> IRL in {city.name}
              </button>
            </div>
            {where === "in_person" ? (
              <div className="mt-2"><VenueSearch value={venue} onChange={setVenue} /></div>
            ) : (
              <Input className="mt-2" type="url" placeholder="Call URL (Zoom, Meet… optional)"
                value={externalCallUrl} onChange={(e) => setExternalCallUrl(e.target.value)} />
            )}
          </section>

          {/* Prompt */}
          <section className="space-y-1.5">
            <Label htmlFor="ws-prompt" className="text-sm">What are we making? <span className="text-xs text-ink-muted">(optional)</span></Label>
            <Textarea id="ws-prompt" rows={3} maxLength={1000} value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder="The constraint, the vibe, what 'done' looks like." />
          </section>

          {/* Cap */}
          <section className="space-y-1.5">
            <Label htmlFor="ws-cap">Seat cap</Label>
            <Input id="ws-cap" type="number" min={2} max={50} value={cap}
              onChange={(e) => setCap(e.target.value === "" ? "" : Math.max(2, Number(e.target.value)))} className="w-28" />
          </section>

          {/* Admin pin */}
          {isAdmin && (
            <section className="rounded-2xl border border-dashed border-border bg-surface p-3">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="mt-1" />
                <span>
                  <span className="inline-flex items-center gap-1 font-medium text-ink"><Pin className="h-3.5 w-3.5" /> Pin as a standing Workshop for {city.name}</span>
                  <span className="block text-xs text-ink-muted">Admin only. Pinned Workshops sit at the top of this city's Workshops tab.</span>
                </span>
              </label>
            </section>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="rounded-full">
              {submitting ? "Posting…" : when === "now" ? "Go live now" : "Schedule Workshop"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
