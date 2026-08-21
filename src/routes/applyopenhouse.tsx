import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import { normalizeUrlOrKeep } from "@/lib/url-normalize";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { submitOpenHouseApplication } from "@/lib/open-house-applications.functions";
import {
  LENGTH_OPTIONS,
  PARTNER_TYPES,
  PERFORMANCE_SUBTYPES,
  isVendorPartner,
  PROPOSAL_MIN,
  PROPOSAL_MAX,
} from "@/lib/open-house";
import { gtagEvent } from "@/lib/analytics/google";

const CANONICAL = "https://workshopindie.com/applyopenhouse";
const DESCRIPTION =
  "Apply to perform, DJ, play, speak, read, screen, teach, or present at a future Workshop Open House.";

export const Route = createFileRoute("/applyopenhouse")({
  component: ApplyOpenHousePage,
  head: () => ({
    meta: [
      { title: "Apply to Workshop Open House | Workshop" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Apply to Workshop Open House" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Apply to Workshop Open House" },
      { name: "twitter:description", content: DESCRIPTION },
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

function ApplyOpenHousePage() {
  const submit = useServerFn(submitOpenHouseApplication);
  const { user } = useAuth();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const [contactName, setContactName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [email, setEmail] = useState("");
  const [partnerType, setPartnerType] = useState("");
  const [performanceSubtype, setPerformanceSubtype] = useState("");
  const [performanceSubtypeOther, setPerformanceSubtypeOther] = useState("");
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [workshopUrl, setWorkshopUrl] = useState("");
  const [proposal, setProposal] = useState("");
  const [approximateLength, setApproximateLength] = useState("");
  const [setupNeeds, setSetupNeeds] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [wantsAccount, setWantsAccount] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [prefilled, setPrefilled] = useState(false);

  // Lite auto-fill: signed-in applicants get their profile basics filled in once.
  const prefillOnce = useRef(false);
  useEffect(() => {
    if (!user || prefillOnce.current) return;
    prefillOnce.current = true;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "display_name, first_name, last_name, username, external_links, home_city_id, city_id, home_city:cities!profiles_home_city_id_fkey(name, state_region, country), city:cities!profiles_city_id_fkey(name, state_region, country)",
        )
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || !data) return;

      const fullName =
        data.display_name?.trim() ||
        [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
      if (fullName) setContactName((v) => v || fullName);
      if (user.email) setEmail((v) => v || user.email!);
      if (data.username) setWorkshopUrl((v) => v || `workshopindie.com/${data.username}`);

      const links = data.external_links;
      if (links && typeof links === "object" && !Array.isArray(links)) {
        const first = Object.values(links as Record<string, unknown>).find(
          (v) => typeof v === "string" && v.trim().length > 0,
        );
        if (typeof first === "string") setPortfolioUrl((v) => v || normalizeUrlOrKeep(first));
      }

      const city = (data.home_city ?? data.city) as
        | { name: string; state_region: string | null; country: string }
        | null;
      if (city) {
        setLocation(
          (v) =>
            v ?? {
              cityId: data.home_city_id ?? data.city_id ?? null,
              providerId: null,
              name: city.name,
              sublabel: [city.state_region, city.country].filter(Boolean).join(", "),
            },
        );
      }
      setPrefilled(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const cityLabel = location ? [location.name, location.sublabel].filter(Boolean).join(", ") : "";

  const isPerformance = partnerType === "performance";
  const isVendor = isVendorPartner(partnerType);
  const proposalLabel = isVendor
    ? "What would you bring to Open House?"
    : "What would you like to bring to Open House?";
  const proposalHint = isVendor
    ? "What you'd sell, sample, show, or activate — and anything you'd bring to the room. A few sentences is plenty."
    : "Describe the set, performance, talk, reading, screening, or demonstration. A few sentences is plenty.";
  const setupLabel = isVendor ? "Space and power needs" : "What would you need?";
  const setupHint = isVendor
    ? "Table size, power, water, load-in — whatever you'd need on site. Details can be worked out later."
    : "A mic, DJ input, projector, small table, open floor, or nothing at all. Details can be worked out later.";

  const proposalLength = proposal.trim().length;
  const proposalTooShort = proposalLength > 0 && proposalLength < PROPOSAL_MIN;

  function focusProposal() {
    const el = document.getElementById("open-house-proposal");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    (el as HTMLTextAreaElement | null)?.focus({ preventScroll: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!partnerType) {
      toast.error("Please choose what you'd like to do.");
      return;
    }
    if (isPerformance && !performanceSubtype) {
      toast.error("Please tell us what kind of performance.");
      return;
    }
    if (!cityLabel) {
      toast.error("Please tell us where you're based.");
      return;
    }
    if (proposal.trim().length < PROPOSAL_MIN) {
      toast.error("Tell us a little more about what you'd like to bring.");
      focusProposal();
      return;
    }
    setBusy(true);
    try {
      await submit({
        data: {
          contactName: contactName.trim(),
          projectName: projectName.trim(),
          email: email.trim(),
          partnerType,
          performanceSubtype: isPerformance ? performanceSubtype || null : null,
          performanceSubtypeOther:
            isPerformance && performanceSubtype === "other" ? performanceSubtypeOther.trim() : "",
          city: cityLabel.slice(0, 160),
          cityId: location?.cityId ?? null,
          portfolioUrl: normalizeUrlOrKeep(portfolioUrl),
          workshopUrl: workshopUrl.trim(),
          proposal: proposal.trim(),
          approximateLength: isVendor ? null : approximateLength || null,
          setupNeeds: setupNeeds.trim(),
          marketingOptIn,
          wantsAccount: !user && wantsAccount,
          website,
        },
      });

      gtagEvent("submit_application", { form_name: "apply_open_house" });

      if (!user && wantsAccount && typeof window !== "undefined") {
        const { first, last } = splitName(contactName);
        const params = new URLSearchParams({ from: "open_house_apply" });
        if (email.trim()) params.set("email", email.trim());
        if (first) params.set("first", first);
        if (last) params.set("last", last);
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
        Workshop Open House
      </p>
      <h1 className="mt-2 font-display text-3xl leading-[1.05] text-ink md:text-4xl">
        Apply to perform or present.
      </h1>
      <p className="mt-3 max-w-xl text-base text-ink-soft">
        Workshop Open House is a gathering for people making things. Some editions include a band,
        DJ set, performance, talk, reading, screening, or demonstration. Tell us what you'd like to
        bring.
      </p>

      {done ? (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-display text-2xl text-ink">Application received.</h2>
          <p className="mt-2 text-ink-soft">
            Thanks for telling us what you'd like to bring to Open House. We read every application
            and reach out when there's a fit.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Your name" required>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
                maxLength={120}
                autoComplete="name"
              />
            </Field>
            <Field label="Act, project, or organization">
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                maxLength={140}
                placeholder="Band name, collective, lecture series…"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
            <Field label="What would you like to do?" required plain>
              <Select
                value={partnerType}
                onValueChange={(v) => {
                  setPartnerType(v);
                  if (v !== "performance") {
                    setPerformanceSubtype("");
                    setPerformanceSubtypeOther("");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent>
                  {PARTNER_TYPES.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      <span className="flex flex-col items-start">
                        <span>{o.label}</span>
                        <span className="text-xs text-ink-muted">{o.hint}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {isPerformance && (
            <div className="grid gap-4 rounded-2xl border border-border bg-surface-2/40 p-4 md:grid-cols-2">
              <Field label="What kind of performance?" required plain>
                <Select value={performanceSubtype} onValueChange={setPerformanceSubtype}>
                  <SelectTrigger>
                    <SelectValue placeholder="DJ, band, comedian…" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERFORMANCE_SUBTYPES.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {performanceSubtype === "other" && (
                <Field label="Tell us what kind">
                  <Input
                    value={performanceSubtypeOther}
                    onChange={(e) => setPerformanceSubtypeOther(e.target.value)}
                    maxLength={80}
                    placeholder="Puppetry, magic, drag…"
                  />
                </Field>
              )}
            </div>
          )}


          <Field label="Where are you based?" required plain>
            <GlobalLocationCombobox
              value={location}
              onSelect={setLocation}
              onClear={() => setLocation(null)}
              placeholder="Search any city or town"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Link to your work"
              required
              hint="A website, Instagram, Bandcamp, SoundCloud, YouTube, Vimeo, portfolio, or another useful example."
            >
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

          <Field label={proposalLabel} required hint={proposalHint}>
            <Textarea
              id="open-house-proposal"
              value={proposal}
              onChange={(e) => setProposal(e.target.value)}
              required
              rows={5}
              maxLength={PROPOSAL_MAX}
              aria-invalid={proposalTooShort || undefined}
            />
            {proposalTooShort && (
              <span className="mt-1 block text-xs text-ink-muted">
                {PROPOSAL_MIN - proposalLength} more character
                {PROPOSAL_MIN - proposalLength === 1 ? "" : "s"} to go.
              </span>
            )}
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            {!isVendor && (
              <Field label="Approximate length" plain>
                <Select value={approximateLength} onValueChange={setApproximateLength}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a length" />
                  </SelectTrigger>
                  <SelectContent>
                    {LENGTH_OPTIONS.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label={setupLabel} hint={setupHint}>
              <Textarea
                value={setupNeeds}
                onChange={(e) => setSetupNeeds(e.target.value)}
                rows={3}
                maxLength={1000}
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
            {user ? (
              <p className="text-sm text-ink-muted">
                Applying while signed in — this application will be linked to your Workshop
                account.
                {prefilled ? " We filled in what we already know; edit anything that's off." : ""}
              </p>
            ) : (
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
            {!user && <p className="text-sm text-ink-muted">No account needed.</p>}
          </div>
        </form>
      )}

      <p className="mt-10 border-t border-border/70 pt-5 text-sm text-ink-muted">
        Applications are considered for future Workshop Open Houses. If there's a fit, we'll email
        you with the venue, date, format, and any compensation before anything is confirmed.
      </p>
    </main>
  );
}
