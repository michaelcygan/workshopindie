import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CityCombobox, type CityValue } from "@/components/city-combobox";
import { TimelinePicker, type TimelineValue } from "@/components/timeline-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { updateCollab } from "@/lib/collab.functions";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/collab/$slug/edit")({
  component: EditCollab,
});

type LocationMode = "online" | "in_person" | "hybrid";
type CompType = "paid" | "unpaid" | "credit" | "negotiable" | "unspecified";
type Rights = "owner_retains" | "equal_split" | "creative_commons" | "decide_later";

const COMP_OPTIONS: { id: CompType; label: string }[] = [
  { id: "paid", label: "Paid" }, { id: "credit", label: "Credit only" },
  { id: "negotiable", label: "Negotiable" }, { id: "unpaid", label: "Unpaid / passion" },
  { id: "unspecified", label: "Not specified" },
];
const RIGHTS_OPTIONS: { id: Rights; label: string }[] = [
  { id: "decide_later", label: "Figure it out together" },
  { id: "creative_commons", label: "Creative Commons" },
  { id: "owner_retains", label: "Owner keeps rights" },
  { id: "equal_split", label: "Equal split" },
];
const LOC_OPTIONS: { id: LocationMode; label: string }[] = [
  { id: "online", label: "Remote" }, { id: "in_person", label: "In person" }, { id: "hybrid", label: "Either" },
];

function EditCollab() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const updateFn = useServerFn(updateCollab);

  const { data: post, isLoading } = useQuery({
    queryKey: ["collab-edit", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collab_posts")
        .select("id,user_id,title,description,timeline_text,timeline_mode,starts_on,ends_on,location_mode,city_id,compensation_type,rights_arrangement,status,slug,city:city_id(id,name,region,country,slug)")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeline, setTimeline] = useState<TimelineValue>({ mode: "flexible", text: "Flexible / soon" });
  const [locationMode, setLocationMode] = useState<LocationMode>("online");
  const [city, setCity] = useState<CityValue | null>(null);
  const [compensationType, setCompensationType] = useState<CompType>("unspecified");
  const [rights, setRights] = useState<Rights>("decide_later");

  useEffect(() => {
    if (!post) return;
    setTitle(post.title || "");
    setDescription(post.description || "");
    setTimeline({
      mode: (post.timeline_mode as TimelineValue["mode"]) || "flexible",
      text: post.timeline_text || "Flexible / soon",
      starts_on: post.starts_on || undefined,
      ends_on: post.ends_on || undefined,
    });
    setLocationMode((post.location_mode as LocationMode) || "online");
    setCity(post.city ? { id: post.city.id, name: post.city.name, region: post.city.region, country: post.city.country, slug: post.city.slug } : null);
    setCompensationType((post.compensation_type as CompType) || "unspecified");
    setRights((post.rights_arrangement as Rights) || "decide_later");
  }, [post]);

  const save = useMutation({
    mutationFn: async () => {
      if (!post) throw new Error("Not loaded");
      return updateFn({
        data: {
          collabPostId: post.id,
          patch: {
            title: title.trim(),
            description: description.trim() || null,
            timeline_text: timeline.text,
            timeline_mode: timeline.mode,
            starts_on: timeline.starts_on || null,
            ends_on: timeline.ends_on || null,
            location_mode: locationMode,
            city_id: locationMode === "online" ? null : (city?.id || null),
            compensation_type: compensationType,
            rights_arrangement: rights,
          },
        },
      });
    },
    onSuccess: (res: { scopeChanged?: boolean; notified?: number } | undefined) => {
      if (res?.scopeChanged) {
        toast.success(`Saved. ${res.notified ?? 0} collaborator(s) asked to re-accept.`);
      } else {
        toast.success("Changes saved.");
      }
      navigate({ to: "/collab/$slug", params: { slug: post!.slug } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const scopeWillChange = useMemo(() => {
    if (!post) return false;
    return (
      title.trim() !== (post.title || "") ||
      (description.trim() || null) !== (post.description || null) ||
      compensationType !== post.compensation_type ||
      rights !== post.rights_arrangement ||
      locationMode !== post.location_mode ||
      (locationMode !== "online" && (city?.id || null) !== post.city_id)
    );
  }, [post, title, description, compensationType, rights, locationMode, city]);

  if (isLoading) return <main className="mx-auto max-w-2xl p-10"><div className="h-64 animate-pulse rounded-3xl bg-surface-2" /></main>;
  if (!post) return <main className="mx-auto max-w-2xl p-10 text-center text-ink-muted">Not found.</main>;
  if (user && post.user_id !== user.id) return <main className="mx-auto max-w-2xl p-10 text-center text-ink-muted">Only the owner can edit this Collab.</main>;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl">Edit Collab</h1>
      <p className="mt-1 text-sm text-ink-muted">Make changes any time — collaborators will be asked to re-accept if the scope shifts.</p>

      <form onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return toast.error("Title is required"); save.mutate(); }} className="mt-6 space-y-6">
        <section className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required />
        </section>

        <section className="space-y-2">
          <Label>What's the idea</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={3000} placeholder="Even a sentence helps." />
        </section>

        <section className="space-y-2">
          <Label>Timeline</Label>
          <TimelinePicker value={timeline} onChange={setTimeline} />
        </section>

        <section className="space-y-2">
          <Label>Where</Label>
          <div className="flex flex-wrap gap-2">
            {LOC_OPTIONS.map((o) => (
              <button key={o.id} type="button" onClick={() => setLocationMode(o.id)}
                className={cn("rounded-full border px-3 py-1.5 text-sm",
                  locationMode === o.id ? "border-transparent bg-ink text-background" : "border-border bg-background text-ink-soft hover:bg-muted")}>
                {o.label}
              </button>
            ))}
          </div>
          {locationMode !== "online" && (
            <CityCombobox value={city} onChange={setCity} placeholder="Pick a city" />
          )}
        </section>

        <section className="space-y-2">
          <Label>Compensation</Label>
          <div className="flex flex-wrap gap-2">
            {COMP_OPTIONS.map((o) => (
              <button key={o.id} type="button" onClick={() => setCompensationType(o.id)}
                className={cn("rounded-full border px-3 py-1.5 text-sm",
                  compensationType === o.id ? "border-transparent bg-ink text-background" : "border-border bg-background text-ink-soft hover:bg-muted")}>
                {o.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <Label>Rights arrangement</Label>
          <div className="flex flex-wrap gap-2">
            {RIGHTS_OPTIONS.map((o) => (
              <button key={o.id} type="button" onClick={() => setRights(o.id)}
                className={cn("rounded-full border px-3 py-1.5 text-sm",
                  rights === o.id ? "border-transparent bg-ink text-background" : "border-border bg-background text-ink-soft hover:bg-muted")}>
                {o.label}
              </button>
            ))}
          </div>
        </section>

        {scopeWillChange && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
            <p className="text-amber-900">Heads up — these edits change the Collab's scope. Existing collaborators will get an Accept prompt before staying on.</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => navigate({ to: "/collab/$slug", params: { slug: post.slug } })}>Cancel</Button>
          <Button type="submit" className="rounded-full" disabled={save.isPending || !title.trim()}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </main>
  );
}
