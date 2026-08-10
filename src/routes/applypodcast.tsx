import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { FIELD_OPTIONS } from "@/lib/taxonomy";
import { normalizeUrlOrKeep } from "@/lib/url-normalize";
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
   *  (Radix Select) where a wrapping label re-triggers the control. */
  plain?: boolean;
  children: React.ReactNode;
}) {
  const Wrapper = plain ? "div" : "label";
  return (
    <Wrapper className="block space-y-2">
      <span className="block text-sm font-medium text-ink">
        {label}
        {!required && <span className="ml-2 text-xs font-normal text-ink-muted">Optional</span>}
      </span>
      {hint && <span className="block text-sm text-ink-muted">{hint}</span>}
      {children}
    </Wrapper>
  );
}



function ApplyPodcastPage() {
  const submit = useServerFn(submitPodcastApplication);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [field, setField] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [socialHandle, setSocialHandle] = useState("");
  const [city, setCity] = useState("");
  const [processDescription, setProcessDescription] = useState("");
  const [currentWork, setCurrentWork] = useState("");
  const [conversationTopics, setConversationTopics] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!field) {
      toast.error("Please choose a field.");
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
          socialHandle: socialHandle.trim(),
          city: city.trim(),
          processDescription: processDescription.trim(),
          currentWork: currentWork.trim(),
          conversationTopics: conversationTopics.trim(),
          marketingOptIn,
          website,
        },
      });
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
    <main className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">
        Workshop Independent
      </p>
      <h1 className="mt-3 font-display text-4xl leading-[1.05] text-ink md:text-5xl">
        Apply to be a guest.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-ink-soft">
        Workshop Independent is a conversation about how independent creative people actually
        work — the process, the constraints, the unglamorous parts. We record with people from
        every field.
      </p>

      {done ? (
        <div className="mt-10 rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-display text-2xl text-ink">Application received.</h2>
          <p className="mt-2 text-ink-soft">
            Thanks for telling us about your work. We read every application and reach out when
            there's a fit.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-10 space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
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

          <div className="grid gap-6 md:grid-cols-2">
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
                placeholder="Documentary editing, modular synths, zines…"
              />
            </Field>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
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
            <Field label="Instagram or social handle">
              <Input
                value={socialHandle}
                onChange={(e) => setSocialHandle(e.target.value)}
                maxLength={120}
                placeholder="@yourhandle"
              />
            </Field>
          </div>

          <Field label="Where you're based">
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={120}
              placeholder="Chicago, IL"
            />
          </Field>

          <Field
            label="Tell us about your process"
            required
            hint="How do you actually make things? What does a working day look like, and what do you keep running into?"
          >
            <Textarea
              value={processDescription}
              onChange={(e) => setProcessDescription(e.target.value)}
              required
              rows={7}
              maxLength={4000}
            />
          </Field>

          <Field label="What are you working on right now">
            <Textarea
              value={currentWork}
              onChange={(e) => setCurrentWork(e.target.value)}
              rows={4}
              maxLength={2000}
            />
          </Field>

          <Field label="What would you enjoy talking about">
            <Textarea
              value={conversationTopics}
              onChange={(e) => setConversationTopics(e.target.value)}
              rows={4}
              maxLength={2000}
            />
          </Field>

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

          <label className="flex items-start gap-3 text-sm text-ink-soft">
            <Checkbox
              checked={marketingOptIn}
              onCheckedChange={(v) => setMarketingOptIn(v === true)}
              className="mt-0.5"
            />
            <span>Send me occasional Workshop updates, opportunities, and events.</span>
          </label>

          <div className="flex items-center gap-4">
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? "Sending…" : "Submit application"}
            </Button>
            <p className="text-sm text-ink-muted">No account needed.</p>
          </div>
        </form>
      )}

      <p className="mt-12 border-t border-border/70 pt-6 text-sm text-ink-muted">
        We read every application. If it's a fit, we'll email you to schedule a recording.
      </p>
    </main>
  );
}
