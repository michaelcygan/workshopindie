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
import { submitFilmFestivalSubmission } from "@/lib/film-festival.functions";
import { FILM_FORMATS, LOGLINE_MAX, SYNOPSIS_MIN, SYNOPSIS_MAX } from "@/lib/film-festival";
import { gtagEvent } from "@/lib/analytics/google";

const CANONICAL = "https://workshopindie.com/film-festival";
const DESCRIPTION =
  "Submit your film to the Workshop Film Festival — a traveling series of pop-up screenings hosted with partner venues. Send a trailer link and, if you'd like, the full film.";

export const Route = createFileRoute("/film-festival")({
  component: FilmFestivalPage,
  head: () => ({
    meta: [
      { title: "Workshop Film Festival — Submit your film" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Workshop Film Festival — Submit your film" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Workshop Film Festival" },
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

function FilmFestivalPage() {
  const submit = useServerFn(submitFilmFestivalSubmission);
  const { user } = useAuth();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [filmTitle, setFilmTitle] = useState("");
  const [workshopUrl, setWorkshopUrl] = useState("");
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [filmFormat, setFilmFormat] = useState("");
  const [runtime, setRuntime] = useState("");
  const [year, setYear] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");
  const [filmUrl, setFilmUrl] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [logline, setLogline] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [credits, setCredits] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [wantsAccount, setWantsAccount] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [prefilled, setPrefilled] = useState(false);

  // Lite auto-fill: signed-in filmmakers get their profile basics filled in once.
  const prefillOnce = useRef(false);
  useEffect(() => {
    if (!user || prefillOnce.current) return;
    prefillOnce.current = true;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "display_name, first_name, last_name, username, home_city_id, city_id, home_city:cities!profiles_home_city_id_fkey(name, state_region, country), city:cities!profiles_city_id_fkey(name, state_region, country)",
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
  const synopsisLength = synopsis.trim().length;
  const synopsisTooShort = synopsisLength > 0 && synopsisLength < SYNOPSIS_MIN;

  function focusSynopsis() {
    const el = document.getElementById("film-synopsis");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    (el as HTMLTextAreaElement | null)?.focus({ preventScroll: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!filmFormat) {
      toast.error("Please choose a format.");
      return;
    }
    if (!cityLabel) {
      toast.error("Please tell us where you're based.");
      return;
    }
    const runtimeMinutes = Number.parseInt(runtime, 10);
    if (!Number.isFinite(runtimeMinutes) || runtimeMinutes <= 0) {
      toast.error("Please add the runtime in minutes.");
      return;
    }
    if (synopsis.trim().length < SYNOPSIS_MIN) {
      toast.error("Tell us a little more about the film.");
      focusSynopsis();
      return;
    }
    if (!rightsConfirmed) {
      toast.error("Please confirm you have the rights to have this film screened.");
      return;
    }
    const completionYear = year.trim() ? Number.parseInt(year, 10) : null;

    setBusy(true);
    try {
      await submit({
        data: {
          contactName: contactName.trim(),
          email: email.trim(),
          filmTitle: filmTitle.trim(),
          workshopUrl: workshopUrl.trim(),
          city: cityLabel.slice(0, 160),
          cityId: location?.cityId ?? null,
          filmFormat,
          runtimeMinutes,
          completionYear: Number.isFinite(completionYear as number) ? completionYear : null,
          trailerUrl: normalizeUrlOrKeep(trailerUrl),
          filmUrl: filmUrl.trim() ? normalizeUrlOrKeep(filmUrl) : "",
          accessNotes: accessNotes.trim(),
          logline: logline.trim(),
          synopsis: synopsis.trim(),
          credits: credits.trim(),
          rightsConfirmed,
          marketingOptIn,
          wantsAccount: !user && wantsAccount,
          website,
        },
      });

      gtagEvent("submit_application", { form_name: "film_festival" });

      if (!user && wantsAccount && typeof window !== "undefined") {
        const { first, last } = splitName(contactName);
        const params = new URLSearchParams({ from: "film_festival_submit" });
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
        Workshop Film Festival
      </p>
      <h1 className="mt-2 font-display text-3xl leading-[1.05] text-ink md:text-4xl">
        Submit your film.
      </h1>
      <p className="mt-3 max-w-xl text-base text-ink-soft">
        The Workshop Film Festival is a traveling set of pop-up screenings hosted with partner
        venues. Shorts, features, documentaries, experimental work, animation, and music videos are
        all welcome. Send a trailer link — and the full film if you're comfortable sharing it.
      </p>

      {done ? (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-display text-2xl text-ink">Submission received.</h2>
          <p className="mt-2 text-ink-soft">
            Thanks for sending your film. We watch every submission and reach out when there's a
            screening that fits.
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
            <Field label="Film title" required>
              <Input
                value={filmTitle}
                onChange={(e) => setFilmTitle(e.target.value)}
                required
                maxLength={200}
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

          <Field label="Where are you based?" required plain>
            <GlobalLocationCombobox
              value={location}
              onSelect={setLocation}
              onClear={() => setLocation(null)}
              placeholder="Search any city or town"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Format" required plain>
              <Select value={filmFormat} onValueChange={setFilmFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent>
                  {FILM_FORMATS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Runtime (minutes)" required>
              <Input
                value={runtime}
                onChange={(e) => setRuntime(e.target.value.replace(/[^\d]/g, ""))}
                required
                inputMode="numeric"
                maxLength={4}
                placeholder="14"
              />
            </Field>
            <Field label="Completion year">
              <Input
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                maxLength={4}
                placeholder="2026"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Trailer link"
              required
              hint="YouTube, Vimeo, or anywhere the trailer or a clip lives."
            >
              <Input
                value={trailerUrl}
                onChange={(e) => setTrailerUrl(e.target.value)}
                onBlur={(e) => setTrailerUrl(normalizeUrlOrKeep(e.target.value))}
                required
                maxLength={500}
                placeholder="vimeo.com/yourfilm"
                inputMode="url"
              />
            </Field>
            <Field
              label="Full film link"
              hint="Google Drive, Vimeo, Dropbox, or a private screener link."
            >
              <Input
                value={filmUrl}
                onChange={(e) => setFilmUrl(e.target.value)}
                onBlur={(e) => setFilmUrl(normalizeUrlOrKeep(e.target.value))}
                maxLength={500}
                placeholder="drive.google.com/…"
                inputMode="url"
              />
            </Field>
          </div>

          <Field
            label="Password or access notes"
            hint="Anything we need to open the link — a Vimeo password, sharing settings, or a download note."
          >
            <Input
              value={accessNotes}
              onChange={(e) => setAccessNotes(e.target.value)}
              maxLength={500}
            />
          </Field>

          <Field label="Logline" required hint="One line. What is the film about?">
            <Input
              value={logline}
              onChange={(e) => setLogline(e.target.value)}
              required
              maxLength={LOGLINE_MAX}
            />
          </Field>

          <Field
            label="About the film"
            required
            hint="Synopsis, how it was made, festival history, or anything else worth knowing."
          >
            <Textarea
              id="film-synopsis"
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              required
              rows={5}
              maxLength={SYNOPSIS_MAX}
              aria-invalid={synopsisTooShort || undefined}
            />
            {synopsisTooShort && (
              <span className="mt-1 block text-xs text-ink-muted">
                {SYNOPSIS_MIN - synopsisLength} more character
                {SYNOPSIS_MIN - synopsisLength === 1 ? "" : "s"} to go.
              </span>
            )}
          </Field>

          <Field label="Credits" hint="Director, writer, cast, crew — however you'd like it listed.">
            <Textarea
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              rows={3}
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

          <div className="space-y-2.5 border-t border-border/70 pt-4">
            <label className="flex items-start gap-3 text-sm text-ink-soft">
              <Checkbox
                checked={rightsConfirmed}
                onCheckedChange={(v) => setRightsConfirmed(v === true)}
                className="mt-0.5"
              />
              <span>
                I have the rights to have this film screened at Workshop Film Festival pop-ups. I
                keep all ownership of my film — screening it at Workshop transfers no rights.
              </span>
            </label>
            {user ? (
              <p className="text-sm text-ink-muted">
                Submitting while signed in — this film will be linked to your Workshop account.
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
              {busy ? "Sending…" : "Submit film"}
            </Button>
            {!user && <p className="text-sm text-ink-muted">No account needed.</p>}
          </div>
        </form>
      )}

      <p className="mt-10 border-t border-border/70 pt-5 text-sm text-ink-muted">
        Submissions are considered for future Workshop Film Festival pop-ups. If there's a fit,
        we'll email you with the venue, date, and format before anything is confirmed. Nothing is
        screened without your go-ahead.
      </p>
    </main>
  );
}
