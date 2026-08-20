import { normalizeUrlOrKeep } from "@/lib/url-normalize";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormDraftStash } from "@/hooks/use-form-draft-stash";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, X, Globe2, Scale, Check, Copy, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { normalizeField, type FieldId } from "@/lib/taxonomy";
import { fieldWritePayload } from "@/lib/work-fields";
import { FieldPicker } from "@/components/field-picker";
import { SubcategoryPicker } from "@/components/subcategory-picker";
import { type CityValue } from "@/components/city-combobox";
import { AuthoringLocationPicker } from "@/components/authoring-location-picker";
import { TimelinePicker, type TimelineValue } from "@/components/timeline-picker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePlus, FREE_OPEN_COLLAB_CAP } from "@/hooks/use-plus";
import { PlusGate } from "@/components/plus-gate";
import { logShareEvent } from "@/lib/collab.functions";
import { useCollabDraftFlow } from "@/lib/collab/use-collab-draft-flow";
import { useDefaultCity } from "@/hooks/use-default-city";

import { GroupPicker, usePreselectGroup, type PickerGroup } from "@/components/group-picker";
import { tagCollabInGroup } from "@/lib/groups.functions";
import { pinCollab } from "@/lib/room-pins.functions";
import { COLLAB_PROMPT_IDS, COLLAB_PROMPTS, type CollabPromptId } from "@/lib/collab-prompts";
import { workshopEntityUrl } from "@/lib/entities/kinds";
import { CollabComposerWalkthrough } from "@/components/nudges/collab-composer-walkthrough";
import type { CollabDraft } from "@/lib/collab-draft";
import { TopicPicker, type PickerTopic } from "@/components/topics/topic-picker";
import { setEntityTopics } from "@/lib/topics.functions";



export const Route = createFileRoute("/collab/new")({
  component: NewCollabRoute,
  validateSearch: z.object({
    group: z.string().optional(),
    fromLounge: z.string().uuid().optional(),
    /** Set when returning from signup to auto-publish a saved draft. */
    resume: z.string().optional(),
    /** Allowlisted starter prompt from the desktop Now board. */
    prompt: z.enum(COLLAB_PROMPT_IDS).optional(),
  }),
});

function NewCollabRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  // Signed-out visitors draft here too: the draft is stored, they create an
  // account, and it publishes itself when they land back.
  const { composerProps } = useCollabDraftFlow({
    returnTo: "/collab/new?resume=1",
    source: "collab_new",
  });
  return (
    <CollabComposer
      groupPreselectId={search.group ?? null}
      fromLounge={search.fromLounge ?? null}
      promptId={search.prompt ?? null}
      onCancel={() => navigate({ to: "/collab" })}
      onDraftSaved={() => navigate({ to: "/me/collabs" })}
      {...composerProps}
      onPosted={(slug) => composerProps.onPosted(slug)}
    />
  );
}


export type CollabComposerProps = {
  /** When present, the composer is mounted inside another surface (e.g. a Lounge dialog). */
  embed?: boolean;
  /** Group id to preselect on mount (from ?group=). */
  groupPreselectId?: string | null;
  /** Allowlisted starter prompt id; prefills empty fields on first mount only. */
  promptId?: CollabPromptId | null;
  /** Lounge id to auto-pin the resulting Collab to. */
  fromLounge?: string | null;
  /** Hydrate every field from a saved draft (acquisition page resume). */
  initialDraft?: CollabDraft | null;
  /** Mirrors the complete draft out on every change. */
  onDraftChange?: (draft: CollabDraft) => void;
  /**
   * Logged-out mode: instead of bouncing to /login on mount, the composer lets
   * the visitor fill everything in and hands the validated draft back here.
   */
  onRequireAuth?: (draft: CollabDraft) => void;
  /** Submit the (restored) draft once, automatically, as soon as we're signed in. */
  autoSubmit?: boolean;
  /** Overrides the primary button label. */
  submitLabel?: string;
  /** Helper copy rendered next to the primary button. */
  helperNote?: string;
  /** Hides the composer's own h1/intro (host page supplies the heading). */
  hideHeading?: boolean;
  onCancel?: () => void;
  onPosted?: (slug: string, id: string) => void;
  onDraftSaved?: () => void;
  
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

const ROLE_PRESETS: Record<FieldId, string[]> = {
  film_video: ["Actor", "Director", "Cinematographer", "Editor", "Sound", "Producer", "Writer"],
  music: ["Vocalist", "Producer", "Instrumentalist", "Songwriter", "Mixer", "Featured artist"],
  writing: ["Co-writer", "Editor", "Beta reader", "Illustrator", "Researcher"],
  visual_art: ["Photographer", "Model", "Stylist", "MUA", "Hair", "Art director", "Retoucher"],
  design: ["Designer", "Art director", "Typographer", "Illustrator", "Motion designer"],
  performance: ["Performer", "Director", "Stage manager", "Musician", "Host"],
  journalism_media: ["Reporter", "Editor", "Photographer", "Fact checker", "Producer"],
  software_ai: ["Designer", "Engineer", "Product", "Researcher", "Co-founder"],
  making_engineering: ["Fabricator", "Engineer", "Designer", "Electronics", "Installer"],
  science_research: ["Researcher", "Analyst", "Field assistant", "Writer", "Reviewer"],
  architecture_cities: ["Architect", "Designer", "Modeler", "Researcher", "Photographer"],
  environment_nature: ["Field researcher", "Photographer", "Writer", "Organizer", "Analyst"],
  other: ["Collaborator", "Producer", "Designer", "Writer", "Editor"],
};

const TIMELINE_SUMMARY: Record<string, string> = {
  asap: "ASAP",
  by_date: "By a date",
  window: "In a window",
  ongoing: "Ongoing",
  flexible: "Flexible timing",
};

/**
 * Collapsible section: keeps the composer to essentials while showing a live
 * summary of what's inside, so nothing feels hidden.
 */
function Disclosure({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left md:p-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">{title}</span>
          <span className="mt-0.5 block truncate text-[11px] text-ink-muted">{summary}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-muted transition", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-5 border-t border-border p-4 md:p-5">{children}</div>}
    </div>
  );
}

export function CollabComposer({
  embed = false,
  groupPreselectId = null,
  fromLounge = null,
  promptId = null,
  initialDraft = null,
  onDraftChange,
  onRequireAuth,
  autoSubmit = false,
  submitLabel,
  helperNote,
  hideHeading = false,
  onCancel,
  onPosted,
  onDraftSaved,
  
}: CollabComposerProps) {
  const { user, loading } = useAuth();
  const { isPlus } = usePlus();
  const [plusGate, setPlusGate] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  /** Acquisition-page mode: the visitor may be logged out and the host page owns the draft. */
  const externalDraft = !!onDraftChange || !!onRequireAuth || !!initialDraft;

  const tagGroup = useServerFn(tagCollabInGroup);
  const pinToRoom = useServerFn(pinCollab);
  const saveTopics = useServerFn(setEntityTopics);
  const preselect = usePreselectGroup(groupPreselectId ?? undefined);

  const [selectedGroups, setSelectedGroups] = useState<PickerGroup[]>(initialDraft?.groups ?? []);
  const [topics, setTopics] = useState<PickerTopic[]>([]);
  useEffect(() => {
    if (preselect.data && preselect.data.length > 0 && selectedGroups.length === 0) {
      setSelectedGroups(preselect.data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect.data]);

  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [category, setCategory] = useState<FieldId>(initialDraft?.category ?? "other");
  const [extraCategories, setExtraCategories] = useState<FieldId[]>(initialDraft?.extraCategories ?? []);
  const [subcategory, setSubcategory] = useState<string | null>(initialDraft?.subcategory ?? null);
  const [description, setDescription] = useState(initialDraft?.description ?? "");
  const [timeline, setTimeline] = useState<TimelineValue>(
    initialDraft?.timeline ?? { mode: "flexible", starts_on: null, ends_on: null },
  );
  const [timelineNote, setTimelineNote] = useState(initialDraft?.timelineNote ?? "");
  const [locationMode, setLocationMode] = useState<LocationMode>(initialDraft?.locationMode ?? "online");
  const [city, setCity] = useState<CityValue | null>(initialDraft?.city ?? null);
  const [showAlsoCities, setShowAlsoCities] = useState((initialDraft?.alsoCities?.length ?? 0) > 0);
  const [alsoCities, setAlsoCities] = useState<CityValue[]>(initialDraft?.alsoCities ?? []);
  const [pendingAlso, setPendingAlso] = useState<CityValue | null>(null);
  const [comp, setComp] = useState<CompType>(initialDraft?.comp ?? "unspecified");
  const [contactMode, setContactMode] = useState<ContactMode>(initialDraft?.contactMode ?? "email_relay");
  const [externalUrl, setExternalUrl] = useState(initialDraft?.externalUrl ?? "");
  const [roles, setRoles] = useState<RoleDraft[]>(
    initialDraft?.roles?.length ? initialDraft.roles : [{ role_name: "", quantity: 1, description: "" }],
  );
  const [rights, setRights] = useState<RightsArrangement>(initialDraft?.rights ?? "decide_later");
  const [acceptsSuggestions, setAcceptsSuggestions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [postedDialog, setPostedDialog] = useState<{ id: string; slug: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const currentDraft: CollabDraft = useMemo(
    () => ({
      title,
      category,
      extraCategories,
      subcategory,
      description,
      timeline,
      timelineNote,
      locationMode,
      city,
      alsoCities,
      comp,
      contactMode,
      externalUrl,
      roles,
      rights,
      groups: selectedGroups,
    }),
    [
      title, category, extraCategories, subcategory, description, timeline, timelineNote,
      locationMode, city, alsoCities, comp, contactMode, externalUrl, roles, rights, selectedGroups,
    ],
  );

  // Mirror the complete draft out to the host page (acquisition flow).
  useEffect(() => {
    onDraftChange?.(currentDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDraft]);

  // Keep typed work if the member navigates away (e.g. mobile composer "+").
  // Disabled when the host page owns a full draft snapshot.
  const draftStash = useFormDraftStash(
    "collab-new",
    { title, description, externalUrl },
    (v) => {
      if (externalDraft) return;
      if (v.title) setTitle(v.title);
      if (v.description) setDescription(v.description);
      if (v.externalUrl) setExternalUrl(v.externalUrl);
    },
  );

  // Starter prompt: fills empty fields once, on first mount. Never overwrites
  // anything the member has already typed, and never submits on its own.
  const promptSeeded = useRef(false);
  useEffect(() => {
    if (promptSeeded.current || !promptId) return;
    const seed = COLLAB_PROMPTS[promptId];
    if (!seed) return;
    promptSeeded.current = true;
    setTitle((t) => (t.trim() ? t : seed.title));
    setDescription((d) => (d.trim() ? d : seed.description));
    setCategory((c) => (c === "other" ? normalizeField(seed.category) : c));
  }, [promptId]);

  // Smart default: prefill the member's home city so "In person" is one tap.
  const defaultCity = useDefaultCity();
  const citySeeded = useRef(false);
  useEffect(() => {
    if (citySeeded.current || city || initialDraft?.city) return;
    const c = defaultCity.data?.city;
    if (!c) return;
    citySeeded.current = true;
    setCity({ id: c.id, name: c.name, country: c.country });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCity.data]);




  useEffect(() => {
    if (!pendingAlso) return;
    if (city?.id === pendingAlso.id) { setPendingAlso(null); return; }
    if (alsoCities.some((c) => c.id === pendingAlso.id)) { setPendingAlso(null); return; }
    if (alsoCities.length >= 4) { toast.error("Up to 4 additional cities"); setPendingAlso(null); return; }
    setAlsoCities((cs) => [...cs, pendingAlso]);
    setPendingAlso(null);
  }, [pendingAlso, alsoCities, city]);

  const filledRoles = useMemo(() => roles.filter((r) => r.role_name.trim()), [roles]);

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
    if (!title.trim()) return toast.error("Give your Collab a title or one-line idea");
    if (contactMode === "external_link" && !externalUrl.trim()) return toast.error("Add a link people can use to contact you");
    if (locationMode !== "online" && !city) return toast.error("Pick a city or set location to Remote");
    if (!user) {
      // Acquisition page: the draft is valid — hand it to the host page, which
      // saves it and opens account creation. Nothing is published yet.
      if (onRequireAuth) return onRequireAuth(currentDraft);
      return;
    }


    // Roles are always optional — freeform pitches are part of the basic model.
    const cleanRoles = roles.filter((r) => r.role_name.trim() && r.quantity > 0);

    const targetStatus = "open" as const;

    if (!isPlus) {
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await supabase
        .from("collab_posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("applications_open", true)
        .is("archived_at", null)
        .is("resulting_work_id", null)
        .or(`ends_on.is.null,ends_on.gte.${today}`);
      if ((count ?? 0) >= FREE_OPEN_COLLAB_CAP) {
        setPlusGate(true);
        return;
      }
    }

    setSubmitting(true);
    const { data: post, error } = await supabase.from("collab_posts").insert({
      title: title.trim(),
      slug: "",
      ...fieldWritePayload(category, extraCategories, subcategory),
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
      accepts_suggestions: true,
      applications_open: true,
      status: targetStatus,
    }).select("id,slug").single();

    if (error || !post) {
      setSubmitting(false);
      if (error?.message?.includes("Free tier collab limit reached")) {
        setPlusGate(true);
        return;
      }
      return toast.error(error?.message ?? "Couldn't post");
    }

    if (topics.length > 0) {
      try {
        await saveTopics({
          data: { kind: "collab", entityId: post.id, topicIds: topics.map((t) => t.id) },
        });
      } catch {
        toast.error("Posted, but topics didn't save. Add them from Edit.");
      }
    }

    if (cleanRoles.length > 0) {
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
    }

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
          e instanceof Error ? `Posted, but couldn't pin to the audio room: ${e.message}` : "Posted, but couldn't pin to the audio room",
        );
      }
    }
    setSubmitting(false);
    draftStash.clear();
    qc.invalidateQueries({ queryKey: ["member-home"] });

    if (embed) {
      // Host surface (e.g. Lounge dialog) handles the "posted" UX.
      onPosted?.(post.slug, post.id);
      return;
    }
    setPostedDialog({ id: post.id, slug: post.slug });
  }

  // Acquisition resume: publish the restored draft exactly once, as soon as the
  // account is ready. `autoSubmit` is only true when the host page has verified
  // the draft hasn't already been published.
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (!autoSubmit || autoSubmitted.current) return;
    if (loading || !user || !title.trim()) return;
    autoSubmitted.current = true;
    void onSubmit({ preventDefault() {} } as unknown as React.FormEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmit, user, loading, title]);




  const shareUrl = postedDialog
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${workshopEntityUrl({ kind: "collab", slug: postedDialog.slug })}`
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

  // Single readiness line: what's ready, or the one thing still missing.
  const pitchValid = title.trim().length > 0;
  const shapeValid = locationMode === "online" || !!city;
  const teamValid = contactMode === "email_relay" || externalUrl.trim().length > 0;
  const allValid = pitchValid && shapeValid && teamValid;
  const readiness = allValid
    ? "Ready to post — you can edit everything later."
    : !pitchValid
      ? "Add a title or one-line idea to continue."
      : !shapeValid
        ? "Pick a city, or set location to Remote."
        : "Add the contact link people should use.";

  return (
    <main className={cn(
      "mx-auto max-w-2xl px-4",
      embed ? "py-6 pb-6" : "py-10 pb-32 md:py-14 md:pb-32",
    )}>

      <CollabComposerWalkthrough />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>

        {!hideHeading && (
          <>
            <h1 className="font-display text-4xl text-ink">Start a Collab</h1>
            <p className="mt-1 text-ink-muted">Start with an idea. Add roles, timing and detail whenever you want — it's In Progress from the moment you start it.</p>
          </>
        )}

        <div className="mt-4 flex items-center gap-2" aria-live="polite">
          <span className={cn("h-2 w-2 rounded-full", allValid ? "bg-ink" : "bg-border")} />
          <span className={cn("text-[11px]", allValid ? "text-ink" : "text-ink-muted")}>{readiness}</span>
        </div>
      </motion.div>


      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {/* Essentials — everything else is one tap away. */}
        <div className="space-y-5 rounded-2xl border border-border bg-surface p-4 md:p-5">
          <section className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" required maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Looking for a vocalist for a moody synthwave EP" />
          </section>

          <FieldPicker
            label="Field"
            primary={category}
            onPrimaryChange={(next) => {
              setCategory(next);
              setSubcategory(null);
            }}
            extras={extraCategories}
            onExtrasChange={setExtraCategories}
            hint="A Collab can span fields (e.g. Music + Visual Art). Star an extra to make it the primary."
          />

          <SubcategoryPicker field={category} value={subcategory} onChange={setSubcategory} />

          <section className="space-y-1.5">
            <Label htmlFor="desc">What's the idea (optional)</Label>
            <Textarea id="desc" rows={5} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Even a sentence works: ‘I want to make a short film this week.’ You can flesh it out later." />
            <p className="text-[11px] text-ink-muted">A line is fine. You can edit anytime.</p>
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
                <AuthoringLocationPicker value={city} onChange={setCity} />

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
                      <AuthoringLocationPicker
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
        </div>

        <Disclosure
          title="Timeline & pay"
          summary={`${TIMELINE_SUMMARY[timeline.mode] ?? "Flexible"} · ${COMP_OPTIONS.find((c) => c.id === comp)?.label ?? "Not specified"}`}
          defaultOpen={timeline.mode !== "flexible" || comp !== "unspecified" || !!timelineNote}
        >
          <section className="space-y-2">
            <Label>Timeline</Label>
            <TimelinePicker value={timeline} onChange={setTimeline} />
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="tlnote" className="text-xs text-ink-muted">Anything else about timing? (optional)</Label>
              <Input id="tlnote" maxLength={120} value={timelineNote} onChange={(e) => setTimelineNote(e.target.value)} placeholder="Evenings only, async OK" />
            </div>
          </section>

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
        </Disclosure>

        <Disclosure
          title="Roles you need"
          summary={filledRoles.length > 0 ? filledRoles.map((r) => r.role_name.trim()).join(", ") : "Optional — anyone can pitch"}
          defaultOpen={filledRoles.length > 0}
        >
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Roles</Label>
              <Button type="button" size="sm" variant="ghost" className="rounded-md gap-1" onClick={() => addRole()}>
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
            <p className="mt-2 rounded-xl border border-border bg-background/60 p-2.5 text-[11px] text-ink-muted">
              Roles are optional. While submissions are open, anyone can also pitch
              another way they could help.
            </p>
          </section>
        </Disclosure>

        <Disclosure
          title="Topics & Groups"
          summary={
            [...topics.map((t) => t.name), ...selectedGroups.map((g) => g.name)].join(", ") ||
            "Help the right people find it"
          }
          defaultOpen={topics.length > 0 || selectedGroups.length > 0}
        >
          <TopicPicker
            value={topics}
            onChange={setTopics}
            max={3}
            helper="What is this Collab about? Topics connect it to everything else on Workshop."
          />
          <GroupPicker value={selectedGroups} onChange={setSelectedGroups} max={3} />
        </Disclosure>

        <Disclosure
          title="Rights & contact"
          summary={`${RIGHTS_OPTIONS.find((o) => o.id === rights)?.label ?? ""} · ${contactMode === "email_relay" ? "In-app message" : "External link"}`}
          defaultOpen={rights !== "decide_later" || contactMode !== "email_relay"}
        >
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
                value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} onBlur={(e) => setExternalUrl(normalizeUrlOrKeep(e.target.value))} />
            )}
          </section>
        </Disclosure>


        {/* Accepted collaborators get a private chat, shared Links, and a meeting button right on the Collab page. */}


        {/* Inline action bar — always visible on mobile, and on all sizes when embedded (dialog has no room for a fixed footer). */}
        <div className={cn(
          "flex flex-wrap items-center justify-end gap-2",
          embed ? "" : "md:hidden",
        )}>
          {helperNote && (
            <p className="mr-auto max-w-sm text-[11px] leading-snug text-ink-muted">{helperNote}</p>
          )}
          {onCancel && (
            <Button type="button" variant="ghost" className="rounded-md" onClick={() => onCancel?.()}>Cancel</Button>
          )}
          <Button type="submit" disabled={submitting || !title.trim()} className="rounded-md">
            {submitting ? "Starting…" : (submitLabel ?? "Start Collab")}
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
            <p className="text-xs text-ink-muted">{helperNote ?? readiness}</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" className="rounded-md" onClick={() => onCancel?.()}>Cancel</Button>
              <Button
                type="button"
                disabled={submitting || !title.trim()}
                variant={allValid ? "default" : "outline"}
                className="rounded-full"
                onClick={(e) => {
                  const form = document.querySelector("form");
                  if (form) form.requestSubmit();
                  else onSubmit(e as unknown as React.FormEvent);
                }}
              >
                {submitting ? "Starting…" : (submitLabel ?? "Start Collab")}
              </Button>
            </div>

          </div>
          <p className="pb-2 text-[11px] text-ink-muted">
            What happens next:&nbsp;
            <span className="text-ink-soft">Start it</span>
            <span className="mx-1.5 opacity-50">→</span>
            <span className="text-ink-soft">Edit anytime</span>
            <span className="mx-1.5 opacity-50">→</span>
            <span className="text-ink-soft">People apply</span>
            <span className="mx-1.5 opacity-50">→</span>
            <span className="text-ink-soft">Publish Work</span>
          </p>
        </div>
      </div>




      <PlusGate
        open={plusGate}
        onOpenChange={setPlusGate}
        reason="collab_limit"
      />
      <Dialog open={!!postedDialog} onOpenChange={(o) => { if (!o) setPostedDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your Collab is live.</DialogTitle>
            <DialogDescription>
              It's open for applications, review, edits, and sharing. Anyone with the link can view it or apply — they don't need an account. Once you accept a collaborator, they can chat, share links, and hop into a meeting with you right on the Collab page.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-1 space-y-1.5">
            <Label htmlFor="share-url" className="text-xs text-ink-muted">Shareable link</Label>
            <div className="flex items-center gap-2">
              <Input id="share-url" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} className="flex-1 text-xs" />
              <Button type="button" size="sm" variant="secondary" className="gap-1.5 rounded-md" onClick={copyShareLink}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-[11px] text-ink-muted">Drop it in IG stories, a group chat, or anywhere your people live.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" className="rounded-md" onClick={() => setPostedDialog(null)}>
              Stay here
            </Button>
            <Button
              type="button"
              className="rounded-md"
              onClick={() => {
                const posted = postedDialog!;
                setPostedDialog(null);
                onPosted?.(posted.slug, posted.id);
              }}
            >
              Open Collab page
            </Button>

          </DialogFooter>

        </DialogContent>
      </Dialog>
    </main>
  );
}
