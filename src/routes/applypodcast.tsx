import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  GlobalLocationCombobox,
  type SelectedLocation,
} from "@/components/global-location-combobox";
import { FIELD_OPTIONS, formatSuggestionsFor } from "@/lib/taxonomy";
import { normalizeUrlOrKeep } from "@/lib/url-normalize";
import { useAuth } from "@/hooks/use-auth";
import { submitPodcastApplication } from "@/lib/podcast.functions";

const CANONICAL = "https://workshopindie.com/applypodcast";
const DESCRIPTION =
  "Workshop Independent is a podcast about how independent creative people actually work. Tell us about your process and apply to be a guest.";

export const Route = createFileRoute("/applypodcast")({
  component: ApplyPodcastPage,
  head: () => ({
    meta: [
      { title: "Apply to Workshop Independent | Workshop" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Apply to Workshop Independent" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
  }),
});

function Field({
  label,
  hint,
  required,
  plain,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  /** Render as a div instead of a <label> — needed for custom controls
   *  (Radix Select, comboboxes) where a wrapping label re-triggers the control. */
  plain?: boolean;
  children: React.ReactNode;
}) {
  const Wrapper = plain ? "div" : "label";
  return (
    <Wrapper className="block space-y-1.5">
      <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-ink">
        {label}
        {!required && <span className="text-xs font-normal text-ink-muted">Optional</span>}
      </span>
      {hint && <span className="block text-xs leading-snug text-ink-muted">{hint}</span>}
      {children}
    </Wrapper>
  );
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

function ApplyPodcastPage() {
  const submit = useServerFn(submitPodcastApplication);
  const { user } = useAuth();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [field, setField] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [workshopUrl, setWorkshopUrl] = useState("");
  const [socialHandle, setSocialHandle] = useState("");
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [processDescription, setProcessDescription] = useState("");
  const [currentWork, setCurrentWork] = useState("");
  const [conversationTopics, setConversationTopics] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [wantsAccount, setWantsAccount] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot

  const specializationOptions = useMemo(
    () => (field ? formatSuggestionsFor([field]) : []),
    [field],
  );

  const cityLabel = location
    ? [location.name, location.sublabel].filter(Boolean).join(", ")
    : "";

  const processLength = processDescription.trim().length;
  const processTooShort = processLength > 0 && processLength < PROCESS_MIN;

  function focusProcess() {
    const el = document.getElementById("podcast-process");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    (el as HTMLTextAreaElement | null)?.focus({ preventScroll: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!field) {
      toast.error("Please choose a field.");
      return;
    }
    if (processDescription.trim().length < PROCESS_MIN) {
      toast.error("Tell us a little more about how you work — a few sentences is plenty.");
      focusProcess();
      return;
    }
    setBusy(true);
    try {
      await submit({
        data: {
          name: name.trim(),
          email: email.trim(),
          field,
          specialization: specialization.trim(),
          portfolioUrl: normalizeUrlOrKeep(portfolioUrl),
          workshopUrl: workshopUrl.trim(),
          socialHandle: socialHandle.trim(),
          city: cityLabel.slice(0, 120),
          cityId: location?.cityId ?? null,
          processDescription: processDescription.trim(),
          currentWork: currentWork.trim(),
          conversationTopics: conversationTopics.trim(),
          marketingOptIn,
          wantsAccount: !user && wantsAccount,
          website,
        },
      });

      if (!user && wantsAccount && typeof window !== "undefined") {
        const { first, last } = splitName(name);
        const params = new URLSearchParams({ from: "podcast_apply" });
        if (email.trim()) params.set("email", email.trim());
        if (first) params.set("first", first);
        if (last) params.set("last", last);
        if (socialHandle.trim()) params.set("ig", socialHandle.trim());
        window.location.assign(`/signup?${params.toString()}`);
        return;
      }

      setDone(true);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">
        Workshop Independent
      </p>
      <h1 className="mt-2 font-display text-3xl leading-[1.05] text-ink md:text-4xl">
        Apply to be a guest.
      </h1>
      <p className="mt-3 max-w-xl text-base text-ink-soft">
        Workshop Independent is a conversation about how independent creative people actually
        work — the process, the constraints, the unglamorous parts. We record with people from
        every field.
      </p>

      {done ? (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-display text-2xl text-ink">Application received.</h2>
          <p className="mt-2 text-ink-soft">
            Thanks for telling us about your work. We read every application and reach out when
            there's a fit.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                autoComplete="name"
              />
            </Field>
            <Field label="Email" required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
                autoComplete="email"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Field" required plain>
              <Select value={field} onValueChange={setField}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a field" />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_OPTIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="What you specialize in">
              <Input
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                maxLength={120}
                list="podcast-specializations"
                placeholder={
                  specializationOptions.length
                    ? `${specializationOptions.slice(0, 2).join(", ")}…`
                    : "Documentary editing, modular synths, zines…"
                }
              />
              <datalist id="podcast-specializations">
                {specializationOptions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Link to your work" required>
              <Input
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                onBlur={(e) => setPortfolioUrl(normalizeUrlOrKeep(e.target.value))}
                required
                maxLength={500}
                placeholder="yoursite.com"
                inputMode="url"
              />
            </Field>
            <Field label="Workshop URL">
              <Input
                value={workshopUrl}
                onChange={(e) => setWorkshopUrl(e.target.value)}
                maxLength={200}
                placeholder="workshopindie.com/yourname"
                inputMode="url"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Instagram or social handle">
              <Input
                value={socialHandle}
                onChange={(e) => setSocialHandle(e.target.value)}
                maxLength={120}
                placeholder="@yourhandle"
              />
            </Field>
            <Field label="Where you're based" plain>
              <GlobalLocationCombobox
                value={location}
                onSelect={setLocation}
                onClear={() => setLocation(null)}
                placeholder="Search any city or town"
              />
            </Field>
          </div>

          <Field
            label="Tell us about your process"
            required
            hint="How do you actually make things? What does a working day look like, and what do you keep running into?"
          >
            <Textarea
              value={processDescription}
              onChange={(e) => setProcessDescription(e.target.value)}
              required
              rows={5}
              maxLength={4000}
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="What are you working on right now">
              <Textarea
                value={currentWork}
                onChange={(e) => setCurrentWork(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </Field>
            <Field label="What would you enjoy talking about">
              <Textarea
                value={conversationTopics}
                onChange={(e) => setConversationTopics(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </Field>
          </div>

          {/* Honeypot */}
          <div className="hidden" aria-hidden>
            <label>
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>

          <div className="space-y-2.5 border-t border-border/70 pt-4">
            {!user && (
              <label className="flex items-start gap-3 text-sm text-ink-soft">
                <Checkbox
                  checked={wantsAccount}
                  onCheckedChange={(v) => setWantsAccount(v === true)}
                  className="mt-0.5"
                />
                <span>Also create my Workshop account.</span>
              </label>
            )}
            <label className="flex items-start gap-3 text-sm text-ink-soft">
              <Checkbox
                checked={marketingOptIn}
                onCheckedChange={(v) => setMarketingOptIn(v === true)}
                className="mt-0.5"
              />
              <span>Send me occasional Workshop updates, opportunities, and events.</span>
            </label>
          </div>

          <div className="flex items-center gap-4">
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? "Sending…" : "Submit application"}
            </Button>
            <p className="text-sm text-ink-muted">No account needed.</p>
          </div>
        </form>
      )}

      <p className="mt-10 border-t border-border/70 pt-5 text-sm text-ink-muted">
        We read every application. If it's a fit, we'll email you to schedule a recording.
      </p>
    </main>
  );
}
