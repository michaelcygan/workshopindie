import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, Loader2, Sparkles, ArrowRight, Play, ChevronDown } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageUpload } from "@/components/image-upload";
import { EmbedPlayer, providerLabel } from "@/components/embed-player";
import { CoverFramer, type CoverAspect, type CoverFocal } from "@/components/cover-framer";
import { CoCreatorPicker, type CoCreator } from "@/components/cocreator-picker";

import { extractWorkFromUrl, type ExtractedWork } from "@/lib/works-import.functions";
import { WORK_CATEGORIES, WORK_SUBTYPES, type Category, type WorkCategory, categoryClass } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePlus, FREE_PORTFOLIO_CAP } from "@/hooks/use-plus";
import { PlusGate } from "@/components/plus-gate";
import { GroupPicker, usePreselectGroup, type PickerGroup } from "@/components/group-picker";
import { tagWorkInGroup } from "@/lib/groups.functions";
import { BookDetailsSection, emptyBookDetails, type BookDetails } from "@/components/book-details-section";

const newWorkSearch = z.object({
  import: z.string().optional(),
  manual: z.coerce.boolean().optional(),
  group: z.string().optional(),
});

export const Route = createFileRoute("/works/new")({
  component: NewWork,
  validateSearch: newWorkSearch,
});

const EXAMPLES = [
  { label: "YouTube", value: "https://www.youtube.com/watch?v=" },
  { label: "SoundCloud", value: "https://soundcloud.com/" },
  { label: "Vimeo", value: "https://vimeo.com/" },
  { label: "Bandcamp", value: "https://" },
];

function NewWork() {
  const { user, loading } = useAuth();
  const { isPlus } = usePlus();
  const [plusGate, setPlusGate] = useState(false);
  const navigate = useNavigate();
  const search = useSearch({ from: "/works/new" });
  const extract = useServerFn(extractWorkFromUrl);
  const tagWorkGroup = useServerFn(tagWorkInGroup);
  const preselect = usePreselectGroup(search.group);
  const [selectedGroups, setSelectedGroups] = useState<PickerGroup[]>([]);
  useEffect(() => {
    if (preselect.data && preselect.data.length > 0 && selectedGroups.length === 0) {
      setSelectedGroups(preselect.data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect.data]);

  type Step = "drop" | "confirm" | "manual";
  const [step, setStep] = useState<Step>(search.manual ? "manual" : "drop");
  const [extracted, setExtracted] = useState<ExtractedWork | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [urlInput, setUrlInput] = useState(search.import ?? "");

  // form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<WorkCategory>("visual");
  const [subtype, setSubtype] = useState<string | null>(null);
  const [excerpt, setExcerpt] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [ownsRights, setOwnsRights] = useState(false);
  const [coCreators, setCoCreators] = useState<CoCreator[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [coverAspect, setCoverAspect] = useState<CoverAspect>("portrait");
  const [coverFocal, setCoverFocal] = useState<CoverFocal>({ x: 50, y: 50 });
  const [myProfile, setMyProfile] = useState<{ display_name: string | null; username: string | null } | null>(null);

  const [book, setBook] = useState<BookDetails>(emptyBookDetails);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name,username").eq("id", user.id).maybeSingle()
      .then(({ data }) => setMyProfile(data));
  }, [user]);

  // If the route arrived with ?import=..., run extract immediately.
  useEffect(() => {
    if (search.import && step === "drop" && !extracting && !extracted) {
      void runExtract(search.import);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.import]);

  function applyExtracted(e: ExtractedWork) {
    setExtracted(e);
    setTitle(e.title ?? "");
    if (e.suggested_category) setCategory(e.suggested_category as WorkCategory);
    setExcerpt(e.description ? e.description.slice(0, 180) : "");
    setDescription(e.description ?? "");
    setCoverUrl(e.cover_url ?? null);
    setPrimaryUrl(e.primary_url);
    setEmbedUrl(e.embed_url);
    setProvider(e.provider);
    if (e.book) {
      setBook({
        ...emptyBookDetails,
        author: e.book.author ?? myProfile?.display_name ?? "",
        buyLinks: e.book.buy_links.length > 0 ? e.book.buy_links : emptyBookDetails.buyLinks,
      });
    }
    setStep("confirm");
  }

  // Video uploads were retired for v1 — Works only embed external video (YouTube/Vimeo).


  async function runExtract(rawUrl: string) {
    const url = rawUrl.trim();
    if (!url) return toast.error("Paste a link first.");
    try {
      new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      return toast.error("That doesn't look like a URL.");
    }
    setExtracting(true);
    try {
      const result = await extract({
        data: { url: url.startsWith("http") ? url : `https://${url}` },
      });
      applyExtracted(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not read that link.";
      toast.error(msg);
    } finally {
      setExtracting(false);
    }
  }

  async function publish(opts: { thenAddAnother?: boolean } = {}) {
    if (!user) return;
    if (!title.trim()) return toast.error("Give it a title.");
    if (!ownsRights) return toast.error("Confirm this is your work, or you have the rights to share it.");

    const isBook = category === "writing_book";
    let bookFields: Record<string, unknown> = {};
    if (isBook) {
      const cleanLinks = book.buyLinks
        .map((l) => ({ label: (l.label || "").trim(), url: (l.url || "").trim() }))
        .filter((l) => l.url.length > 0);
      // Validate URLs
      for (const l of cleanLinks) {
        try { new URL(l.url); } catch { return toast.error(`"${l.label || "Buy link"}" isn't a valid URL.`); }
      }
      if (book.excerptUrl) {
        try { new URL(book.excerptUrl); } catch { return toast.error("Sample chapter link isn't a valid URL."); }
      }
      bookFields = {
        book_author: book.author.trim() || null,
        book_publisher: book.publisher.trim() || null,
        book_isbn: book.isbn.trim() || null,
        book_published_on: book.publishedOn || null,
        book_page_count: book.pageCount ? Number(book.pageCount) || null : null,
        book_buy_links: cleanLinks,
        book_excerpt_url: book.excerptUrl.trim() || null,
      };
    }

    // Free tier cap on published works
    if (!isPlus) {
      const { count } = await supabase
        .from("works")
        .select("id", { count: "exact", head: true })
        .eq("created_by", user.id)
        .eq("status", "published");
      if ((count ?? 0) >= FREE_PORTFOLIO_CAP) {
        setPlusGate(true);
        return;
      }
    }

    setSubmitting(true);

    const { data: work, error } = await supabase
      .from("works")
      .insert({
        title: title.trim(),
        slug: "",
        category: category as Category,
        subtype: subtype,
        excerpt: excerpt || null,
        description: description || null,
        cover_url: coverUrl,
        cover_aspect: coverAspect,
        cover_focal_x: coverFocal.x,
        cover_focal_y: coverFocal.y,
        primary_url: primaryUrl || null,
        embed_url: isBook ? null : embedUrl,
        source_type: "manual",
        license_type: "portfolio_credit_only",
        ownership_certified_at: new Date().toISOString(),
        status: "published",
        visibility: "public",
        created_by: user.id,
        ...bookFields,

      })
      .select("id,slug")
      .single();

    if (error || !work) {
      setSubmitting(false);
      return toast.error(error?.message ?? "Failed to publish");
    }

    // Creator credit (self)
    const credits: Array<{
      work_id: string;
      user_id: string | null;
      display_name: string | null;
      role_label: string;
      sort_order: number;
    }> = [
      {
        work_id: work.id,
        user_id: user.id,
        display_name: null,
        role_label: "Creator",
        sort_order: 0,
      },
    ];
    coCreators.forEach((c, i) => {
      credits.push({
        work_id: work.id,
        user_id: c.user_id,
        display_name: c.user_id ? null : c.display_name,
        role_label: "Co-creator",
        sort_order: i + 1,
      });
    });
    await supabase.from("work_credits").insert(credits);




    // Tag into selected Groups (best-effort)
    if (selectedGroups.length > 0) {
      const results = await Promise.allSettled(
        selectedGroups.map((g) =>
          tagWorkGroup({ data: { group_id: g.id, work_id: work.id } }),
        ),
      );
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          toast.error(`Posted. Couldn't tag ${selectedGroups[i].name}, try from the group page.`);
        }
      });
    }

    setSubmitting(false);
    toast.success("Work published");

    if (opts.thenAddAnother) {
      setExtracted(null);
      setTitle(""); setExcerpt(""); setDescription("");
      setCoverUrl(null); setPrimaryUrl(""); setEmbedUrl(null);
      setProvider(null); setSubtype(null); setOwnsRights(false);
      setCoCreators([]); setDetailsOpen(false);
      setCoverAspect("portrait"); setCoverFocal({ x: 50, y: 50 });

      setBook(emptyBookDetails);
      setUrlInput("");
      setStep("drop");
      navigate({ to: "/works/new", search: {} });
    } else {
      navigate({ to: "/works/$slug", params: { slug: work.slug } });
    }
  }

  const subtypeOptions = WORK_SUBTYPES[category] ?? [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl text-ink">Publish a Work</h1>
        <p className="mt-1 text-ink-muted">
          Drop a link, upload a file, or start from scratch — we'll do the rest.
        </p>
        <a
          href="/works/collab/new"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Or start a collaborative Work — invite people to ship it with you →
        </a>
      </motion.div>

      {step === "drop" && (
        <DropStep
          urlInput={urlInput}
          setUrlInput={setUrlInput}
          extracting={extracting}
          onSubmit={() => runExtract(urlInput)}
          onManual={() => setStep("manual")}
        />
      )}


      {(step === "confirm" || step === "manual") && (
        <form
          onSubmit={(e) => { e.preventDefault(); void publish(); }}
          className="mt-8 space-y-6"
        >
          {step === "confirm" && extracted && embedUrl && (
            <PreviewCard
              extracted={extracted}
              embedUrl={embedUrl}
              title={title}
            />
          )}

          {/* Cover */}
          <section className="space-y-3">
            <Label>Cover</Label>
            {coverUrl ? (
              <>
                <CoverFramer
                  src={coverUrl}
                  aspect={coverAspect}
                  focal={coverFocal}
                  onAspectChange={setCoverAspect}
                  onFocalChange={setCoverFocal}
                />
                <button
                  type="button"
                  onClick={() => setCoverUrl(null)}
                  className="text-xs text-ink-muted hover:text-ink underline underline-offset-2"
                >
                  Replace cover image
                </button>
                {extracted?.cover_url && coverUrl === extracted.cover_url && (
                  <p className="text-xs text-ink-muted">
                    Pulled from {providerLabel(extracted.provider) ?? "the link"}. Pick a crop and tap to set the focal point.
                  </p>
                )}
              </>
            ) : (
              <ImageUpload
                value={coverUrl}
                onChange={setCoverUrl}
                bucket="work-covers"
                aspect="portrait"
                label="Upload a cover image (≤3MB, auto-resized)"
              />
            )}
          </section>


          {/* Title */}
          <section className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What is it called?"
            />
          </section>

          {/* Category */}
          <section className="space-y-2">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-2">
              {WORK_CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => { setCategory(c.id as WorkCategory); setSubtype(null); }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition",
                    category === c.id
                      ? cn("border-transparent", categoryClass(c.id))
                      : "border-border bg-surface text-ink-soft hover:bg-muted",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {subtypeOptions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {subtypeOptions.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setSubtype(subtype === s ? null : s)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition",
                      subtype === s
                        ? "border-ink bg-ink text-background"
                        : "border-border bg-background text-ink-soft hover:bg-muted",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-ink-muted">Subtype is optional — helps people find your work.</p>
          </section>

          {/* Book details — only when Book category is selected */}
          {category === "writing_book" && (
            <BookDetailsSection value={book} onChange={setBook} />
          )}



          {/* Ownership self-cert */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={ownsRights}
                onCheckedChange={(v) => setOwnsRights(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-ink">
                <span className="font-medium">I made this, or I have the rights to share it.</span>
                <span className="mt-1 block text-xs text-ink-muted">
                  You can fine-tune rights and add downloads later from the Work page.
                </span>
              </span>
            </label>
          </section>

          {/* Add details (collapsed) */}
          <section className="rounded-2xl border border-border bg-surface">
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm text-ink-soft hover:text-ink"
            >
              <span className="font-medium">Add details</span>
              <span className="flex items-center gap-2 text-xs text-ink-muted">
                {coCreators.length > 0 && <span>{coCreators.length} co-creator{coCreators.length === 1 ? "" : "s"}</span>}
                {selectedGroups.length > 0 && <span>{selectedGroups.length} group{selectedGroups.length === 1 ? "" : "s"}</span>}
                <ChevronDown className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")} />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {detailsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-5 border-t border-border px-4 py-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="excerpt">One-line excerpt</Label>
                      <Input
                        id="excerpt"
                        maxLength={180}
                        value={excerpt}
                        onChange={(e) => setExcerpt(e.target.value)}
                        placeholder="A short tagline."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="desc">Description</Label>
                      <Textarea
                        id="desc"
                        rows={5}
                        maxLength={3000}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What is it? Who is it for? How was it made?"
                      />
                    </div>

                    <CoCreatorPicker
                      value={coCreators}
                      onChange={setCoCreators}
                      excludeUserIds={user ? [user.id] : []}
                    />

                    <div className="space-y-1.5">
                      <Label htmlFor="url">Source URL</Label>
                      <Input
                        id="url"
                        type="url"
                        value={primaryUrl}
                        onChange={(e) => setPrimaryUrl(e.target.value)}
                        placeholder="https://…"
                      />
                      <p className="text-xs text-ink-muted">Where the original lives — Vimeo, Bandcamp, GitHub, your site.</p>
                    </div>

                    <GroupPicker value={selectedGroups} onChange={setSelectedGroups} max={3} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Credit summary */}
          <div className="text-sm text-ink-muted">
            You'll be credited as <span className="text-ink">{myProfile?.display_name || myProfile?.username || "yourself"}</span>
            {coCreators.length > 0 && (
              <> with {coCreators.map((c) => c.display_name).join(", ")}</>
            )}.
          </div>

          {/* Sticky publish bar */}
          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-border bg-background/95 backdrop-blur p-3 shadow-lift">
            <Button
              type="button"
              variant="ghost"
              className="rounded-full mr-auto"
              onClick={() => {
                if (step === "confirm") { setStep("drop"); setExtracted(null); }
                else navigate({ to: "/" });
              }}
            >
              {step === "confirm" ? "← Back" : "Cancel"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              className="rounded-full"
              onClick={() => void publish({ thenAddAnother: true })}
            >
              + Add another
            </Button>
            <Button type="submit" disabled={submitting} className="rounded-full">
              {submitting ? "Publishing…" : "Publish Work"}
            </Button>
          </div>
        </form>
      )}
      <PlusGate
        open={plusGate}
        onOpenChange={setPlusGate}
        title="You've hit 10 published works"
        description="Free portfolios cap at 10. Go Plus for unlimited works."
      />
    </main>
  );
}

function DropStep({
  urlInput, setUrlInput, extracting, onSubmit, onManual,
}: {
  urlInput: string;
  setUrlInput: (v: string) => void;
  extracting: boolean;
  onSubmit: () => void;
  onManual: () => void;

}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="mt-8 space-y-6"
    >
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-soft md:p-8">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Sparkles className="h-4 w-4 text-primary" />
          Paste a link — we'll pull the cover, title, and embed
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
          className="mt-3 flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              autoFocus
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://…"
              className="pl-9 h-12 text-base"
              disabled={extracting}
            />
          </div>
          <Button type="submit" disabled={extracting || !urlInput.trim()} className="h-12 rounded-full gap-1.5 px-5">
            {extracting ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading…</> : <>Continue <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => setUrlInput(ex.value)}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs text-ink-soft hover:bg-muted transition"
            >
              {ex.label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          For photos, illustrations, or anything without a link — start from scratch and upload below.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <VideoUploadButton onUploaded={onVideoUploaded} />
        <button
          type="button"
          onClick={onManual}
          className="text-sm text-ink-muted hover:text-ink underline underline-offset-2"
        >
          Or start from scratch →
        </button>
      </div>
    </motion.div>
  );
}

function PreviewCard({
  extracted, embedUrl, title,
}: {
  extracted: ExtractedWork;
  embedUrl: string;
  title: string;
}) {
  const label = providerLabel(extracted.provider);
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-soft">
      <EmbedPlayer url={embedUrl} provider={extracted.provider} title={title} className="rounded-none border-0" />
      <div className="p-4">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          {label && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5">
              <Play className="h-3 w-3" /> {label}
            </span>
          )}
          {extracted.author_name && <span>by {extracted.author_name}</span>}
        </div>
        <p className="mt-2 text-sm text-ink">{title || extracted.title}</p>
      </div>
    </div>
  );
}
