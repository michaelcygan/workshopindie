import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Link2, Loader2, Sparkles, ArrowRight, Play } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/image-upload";
import { EmbedPlayer, providerLabel } from "@/components/embed-player";
import { VideoUploadButton, type StreamUploadResult } from "@/components/video-upload-button";
import { extractWorkFromUrl, type ExtractedWork } from "@/lib/works-import.functions";
import { WORK_CATEGORIES, type Category, categoryClass } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePlus, FREE_PORTFOLIO_CAP } from "@/hooks/use-plus";
import { PlusGate } from "@/components/plus-gate";

const newWorkSearch = z.object({
  import: z.string().optional(),
  manual: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/works/new")({
  component: NewWork,
  validateSearch: newWorkSearch,
});

const LICENSES = [
  { id: "cc_by", label: "CC BY — credit required" },
  { id: "portfolio_credit_only", label: "Portfolio + credit only" },
  { id: "rights_managed_externally", label: "Rights managed externally" },
  { id: "private", label: "Private (you only)" },
] as const;

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

  type Step = "drop" | "confirm" | "manual";
  const [step, setStep] = useState<Step>(search.manual ? "manual" : "drop");
  const [extracted, setExtracted] = useState<ExtractedWork | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [urlInput, setUrlInput] = useState(search.import ?? "");

  // form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("visual");
  const [excerpt, setExcerpt] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [license, setLicense] = useState<typeof LICENSES[number]["id"]>("cc_by");
  const [submitting, setSubmitting] = useState(false);
  const [streamUid, setStreamUid] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<{ display_name: string | null; username: string | null } | null>(null);

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
    if (e.suggested_category) setCategory(e.suggested_category);
    setExcerpt(e.description ? e.description.slice(0, 180) : "");
    setDescription(e.description ?? "");
    setCoverUrl(e.cover_url ?? null);
    setPrimaryUrl(e.primary_url);
    setEmbedUrl(e.embed_url);
    setProvider(e.provider);
    setStep("confirm");
  }

  function applyVideoUpload(r: StreamUploadResult) {
    setStreamUid(r.uid);
    setProvider("cloudflare_stream");
    setEmbedUrl(r.hlsUrl);
    if (r.thumbnailUrl && !coverUrl) setCoverUrl(r.thumbnailUrl);
    setExtracted({
      title: title || "",
      description: null,
      cover_url: r.thumbnailUrl,
      primary_url: r.hlsUrl,
      embed_url: r.hlsUrl,
      provider: "cloudflare_stream",
      author_name: null,
      suggested_category: "visual",
    } as unknown as ExtractedWork);
    setStep("confirm");
  }



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
    if (!title.trim()) return toast.error("Title is required");

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
        category,
        excerpt: excerpt || null,
        description: description || null,
        cover_url: coverUrl,
        primary_url: primaryUrl || null,
        embed_url: embedUrl,
        source_type: "manual",
        license_type: license,
        status: "published",
        visibility: "public",
        created_by: user.id,
      })
      .select("id,slug")
      .single();

    if (error || !work) {
      setSubmitting(false);
      return toast.error(error?.message ?? "Failed to publish");
    }

    await supabase.from("work_credits").insert({
      work_id: work.id,
      user_id: user.id,
      role_label: "Creator",
      sort_order: 0,
    });

    // Link uploaded Cloudflare Stream asset (if any) to this work
    if (streamUid) {
      await supabase
        .from("media_assets")
        .update({ work_id: work.id })
        .eq("provider", "cloudflare_stream")
        .eq("provider_uid", streamUid)
        .eq("owner_id", user.id);
    }

    setSubmitting(false);
    toast.success("Work published");

    if (opts.thenAddAnother) {
      // reset and return to drop state
      setExtracted(null);
      setTitle(""); setExcerpt(""); setDescription("");
      setCoverUrl(null); setPrimaryUrl(""); setEmbedUrl(null);
      setProvider(null); setLicense("cc_by");
      setStreamUid(null);
      setUrlInput("");
      setStep("drop");
      navigate({ to: "/works/new", search: {} });
    } else {
      navigate({ to: "/works/$slug", params: { slug: work.slug } });
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl text-ink">Publish a Work</h1>
        <p className="mt-1 text-ink-muted">
          Drop a link to something you've made — we'll fill in the rest.
        </p>
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
          className="mt-8 space-y-7"
        >
          {step === "confirm" && extracted && (
            <PreviewCard
              extracted={extracted}
              embedUrl={embedUrl}
              coverUrl={coverUrl}
              title={title}
            />
          )}

          <section className="space-y-2">
            <Label>Cover</Label>
            <ImageUpload
              value={coverUrl}
              onChange={setCoverUrl}
              bucket="work-covers"
              aspect="portrait"
              label={extracted?.cover_url ? "Replace cover image" : "Upload a 4:5 cover image"}
            />
            {extracted?.cover_url && coverUrl === extracted.cover_url && (
              <p className="text-xs text-ink-muted">Pulled from {providerLabel(extracted.provider) ?? "the link"}.</p>
            )}
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" required maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is it called?" />
          </section>

          <section className="space-y-2">
            <Label>Category</Label>
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
            <Label htmlFor="excerpt">One-line excerpt</Label>
            <Input id="excerpt" maxLength={180} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="A short tagline." />
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" rows={6} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is it? Who is it for? How was it made?" />
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="url">Source URL</Label>
            <Input id="url" type="url" value={primaryUrl} onChange={(e) => setPrimaryUrl(e.target.value)} placeholder="https://…" />
            <p className="text-xs text-ink-muted">Where the original lives — Vimeo, Bandcamp, GitHub, your site.</p>
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="lic">License</Label>
            <select id="lic" value={license} onChange={(e) => setLicense(e.target.value as typeof license)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              {LICENSES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </section>

          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-ink-muted">
            You'll be credited as <span className="text-ink">{myProfile?.display_name || myProfile?.username || "yourself"}</span>.
            Co-creator credits open up when you publish through a Workshop.
          </div>

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
          Paste a SoundCloud, YouTube, Vimeo, Bandcamp, Spotify, or any link
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
          Drop links to work you made or co-made. We honor what you claim — misuse can be reported from the Work page.
        </p>
      </div>

      <div className="text-center">
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
  extracted, embedUrl, coverUrl, title,
}: {
  extracted: ExtractedWork;
  embedUrl: string | null;
  coverUrl: string | null;
  title: string;
}) {
  const label = providerLabel(extracted.provider);
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-soft">
      {embedUrl ? (
        <EmbedPlayer url={embedUrl} provider={extracted.provider} title={title} className="rounded-none border-0" />
      ) : coverUrl ? (
        <img src={coverUrl} alt="" className="w-full aspect-video object-cover" />
      ) : (
        <div className="aspect-video w-full gradient-soft" />
      )}
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
