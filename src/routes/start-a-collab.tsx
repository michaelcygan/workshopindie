import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { WorkshopBrandLink } from "@/components/workshop-brand-link";
import { CollabCard, type CollabCardData } from "@/components/collab-card";
import { CollabPeek } from "@/components/collab-peek";
import { COLLAB_CARD_SELECT } from "@/lib/collab/card-select";
import { recruitingCollabs } from "@/lib/collab/query";
import { CollabComposer } from "@/routes/collab.new";
import { gtagEvent } from "@/lib/analytics/google";
import { shareImageMeta } from "@/lib/og-image";
import { useCollabDraftFlow } from "@/lib/collab/use-collab-draft-flow";


const TITLE = "Post a Collab | Workshop";
const DESCRIPTION =
  "Create a public call for collaboration, share it anywhere, and receive applications from people inside or outside Workshop.";

export const Route = createFileRoute("/start-a-collab")({
  component: StartACollabPage,
  // Ad traffic arrives with UTM params; keep them addressable, not stripped.
  validateSearch: z
    .object({
      resume: z.string().optional(),
      utm_source: z.string().optional(),
      utm_medium: z.string().optional(),
      utm_campaign: z.string().optional(),
      utm_content: z.string().optional(),
      utm_term: z.string().optional(),
    })
    .parse,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      ...shareImageMeta(null, "Post a Collab on Workshop"),
    ],
  }),
});

const STEPS = [
  {
    n: "01",
    title: "Describe what you're making",
    body: "Post the project, idea, opportunity, or question and explain who or what you need.",
  },
  {
    n: "02",
    title: "Share the public Collab page",
    body: "Send the link through social media, email, text, Groups, or anywhere your network already exists.",
  },
  {
    n: "03",
    title: "Receive applications",
    body: "People can respond without first joining Workshop. Review applications and invite the right collaborators into the project.",
  },
];

/* Small decorative line marks. Desktop only, monochrome, no assets. */
function GlyphSignal(props: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" fill="none" aria-hidden className={props.className}>
      <circle cx="12" cy="20" r="5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M22 20h30" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M26 12c6 5 6 11 0 16M35 9c9 7 9 15 0 22M44 6c12 9 12 19 0 28" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

function GlyphFeedback(props: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={props.className}>
      <path d="M4 8h18v12H12l-6 5v-5H4z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M26 12h2v12h-4l-3 3v-3h-5" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}

function GlyphRoles(props: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={props.className}>
      <circle cx="16" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="7" cy="24" r="3.5" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="25" cy="24" r="3.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M16 11v6M16 17l-7 4M16 17l7 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function GlyphTrack(props: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={props.className}>
      <path d="M5 26V6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <rect x="9" y="7" width="14" height="4" rx="2" stroke="currentColor" strokeWidth="1.25" />
      <rect x="9" y="14" width="19" height="4" rx="2" stroke="currentColor" strokeWidth="1.25" opacity="0.7" />
      <rect x="9" y="21" width="10" height="4" rx="2" stroke="currentColor" strokeWidth="1.25" opacity="0.45" />
    </svg>
  );
}

const PILLARS = [
  {
    Icon: GlyphFeedback,
    title: "Open feedback",
    body:
      "Anyone with the link can read your Collab and respond — including people who have never heard of Workshop. No sign-up wall between you and the person who wants in.",
  },
  {
    Icon: GlyphRoles,
    title: "Structured roles",
    body:
      "Say exactly who you need — director, bassist, editor, co-writer — instead of a vague post. Applicants apply to a specific role, so you can compare like for like.",
  },
  {
    Icon: GlyphTrack,
    title: "Keep track of the production",
    body:
      "The Collab page stays live as the project's home: applications, collaborators, updates and links in one place from first idea to finished thing.",
  },
];

const PROOF = ["Free to post", "Public shareable link", "No account needed to apply"];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function StartACollabPage() {
  const search = Route.useSearch();
  const { user, loading } = useAuth();

  const [peekId, setPeekId] = useState<string | null>(null);

  const { composerProps } = useCollabDraftFlow({
    returnTo: "/start-a-collab?resume=1",
    source: "collab_landing",
  });

  useEffect(() => {
    gtagEvent("select_content", {
      content_type: "collab_landing",
      item_id: "acquisition_page_viewed",
    });
  }, []);

  const examples = useQuery({
    queryKey: ["start-a-collab", "examples"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await recruitingCollabs(
        supabase.from("collab_posts").select(COLLAB_CARD_SELECT),
      )
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data ?? []) as unknown as CollabCardData[];
    },
  });


  const cards = examples.data ?? [];
  const showExamples = cards.length > 0;

  function startClick() {
    gtagEvent("select_content", {
      content_type: "collab_landing",
      item_id: "start_a_collab_clicked",
    });
    scrollToId("start-your-collab");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal, page-only header — no site navigation here on purpose. */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <WorkshopBrandLink size="compact" />
          <div className="ml-auto">
            {loading ? null : user ? null : (
              <Link to="/login" search={{ redirect: "/start-a-collab" }}>
                <Button size="sm" variant="ghost" className="rounded-md">
                  Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24">
        {/* Hero */}
        <section className="border-b border-border py-14 md:py-20">
          <p className="text-[11px] uppercase tracking-[0.2em] text-ink-muted">
            Workshop — where people find collaborators
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.02] tracking-[-0.03em] text-ink md:text-6xl">
            Find the people to make it with.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft md:text-lg">
            A Collab is a public page for one project. Describe what you're making and who you
            need, share the link anywhere, and collect applications from people inside or outside
            Workshop — they don't need an account to respond.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Button size="lg" className="rounded-md" onClick={startClick}>
              Start a Collab
            </Button>
            {showExamples && (
              <button
                type="button"
                onClick={() => scrollToId("open-collabs")}
                className="text-sm font-medium text-ink underline underline-offset-4 hover:text-ink-soft"
              >
                See open Collabs
              </button>
            )}
            <GlyphSignal className="ml-2 hidden h-9 w-16 text-ink-muted/50 md:block" />
          </div>

          <ul className="mt-6 flex flex-wrap gap-2">
            {PROOF.map((p) => (
              <li
                key={p}
                className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-ink-soft"
              >
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* What is a Collab */}
        <section className="border-b border-border py-12" aria-labelledby="what-is-a-collab">
          <h2 id="what-is-a-collab" className="font-display text-2xl text-ink md:text-3xl">
            What is a Collab?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft md:text-base">
            Not a job post and not a status update — a working page for a project that needs
            people. It's free, it's public, and it stays useful after the first reply.
          </p>
          <div className="mt-7 grid gap-x-10 gap-y-7 md:grid-cols-2">
            {PILLARS.map(({ Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <Icon className="hidden h-7 w-7 shrink-0 text-ink-muted md:block" />
                <div>
                  <h3 className="font-display text-lg leading-snug text-ink">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-border py-12" aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="font-display text-2xl text-ink md:text-3xl">
            How it works
          </h2>
          <div className="mt-6 grid gap-8 md:grid-cols-3 md:gap-6">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="font-display text-3xl leading-none text-ink-muted/40">{s.n}</span>
                <div className="mt-3 h-px w-full bg-border" />
                <h3 className="mt-3 font-display text-lg leading-snug text-ink">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Real, currently recruiting Collabs */}
        {showExamples && (
          <section id="open-collabs" className="border-b border-border py-12" aria-labelledby="examples-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="examples-heading" className="font-display text-2xl text-ink md:text-3xl">
                See what people are making
              </h2>
              <Link
                to="/collab"
                className="text-sm font-medium text-ink underline underline-offset-4 hover:text-ink-soft"
              >
                Browse all Collabs
              </Link>
            </div>
            <p className="mt-2 text-sm text-ink-soft">Real Collabs, open right now.</p>
            <div className="mt-6 -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0">
              {cards.map((post) => (
                <div
                  key={post.id}
                  className="w-[85vw] shrink-0 snap-start sm:w-[70vw] md:w-auto"
                  onClickCapture={(e) => {
                    // Keep the visitor on the landing page: preview in place.
                    e.preventDefault();
                    e.stopPropagation();
                    gtagEvent("select_content", {
                      content_type: "collab_landing",
                      item_id: "preview_opened",
                    });
                    setPeekId(post.id);
                  }}
                >
                  <CollabCard post={post} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* The real composer */}
        <section id="start-your-collab" className="py-12" aria-labelledby="start-heading">
          <h2 id="start-heading" className="font-display text-2xl text-ink md:text-3xl">
            Start your Collab
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Takes about a minute. You only need a free account when you publish.
          </p>
          <div className="-mx-4 mt-4 md:mx-0">
            <CollabComposer embed hideHeading {...composerProps} />
          </div>
        </section>

        {/* Closing call to action */}
        <section className="border-t border-border py-12">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <p className="max-w-xl font-display text-xl leading-snug text-ink md:text-2xl">
              Whatever you're making, someone out there wants to help make it.
            </p>
            <div className="flex items-center gap-3">
              <GlyphSignal className="hidden h-8 w-14 text-ink-muted/50 md:block" />
              <Button size="lg" className="rounded-md" onClick={startClick}>
                Start a Collab
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 text-xs text-ink-muted">
          <WorkshopBrandLink size="compact" className="-ml-2" />
          <span>A public call for collaboration.</span>
          <span className="ml-auto">
            {search.resume ? "Publishing your draft…" : "© Workshop"}
          </span>
        </div>
      </footer>

      <CollabPeek collabId={peekId} open={!!peekId} onOpenChange={(o) => !o && setPeekId(null)} />
    </div>
  );
}
