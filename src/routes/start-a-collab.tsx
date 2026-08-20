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
          <h1 className="max-w-3xl font-display text-4xl leading-[1.02] tracking-[-0.03em] text-ink md:text-6xl">
            Find the people to make it with.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft md:text-lg">
            A Collab is a public call for collaboration. Describe what you're making, share the
            link anywhere, and receive applications from people inside or outside Workshop.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Button
              size="lg"
              className="rounded-md"
              onClick={() => {
                gtagEvent("select_content", {
                  content_type: "collab_landing",
                  item_id: "start_a_collab_clicked",
                });
                scrollToId("start-your-collab");
              }}
            >
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
          </div>
          <p className="mt-5 text-xs uppercase tracking-[0.14em] text-ink-muted">
            Applicants do not need a Workshop account to respond.
          </p>
        </section>

        {/* How it works */}
        <section className="border-b border-border py-12" aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="font-display text-2xl text-ink md:text-3xl">
            How it works
          </h2>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border bg-surface p-4 md:p-5">
                <span className="text-[11px] font-medium tracking-[0.18em] text-ink-muted">
                  {s.n}
                </span>
                <h3 className="mt-2 font-display text-lg leading-snug text-ink">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Real, currently recruiting Collabs */}
        {showExamples && (
          <section id="open-collabs" className="border-b border-border py-12" aria-labelledby="examples-heading">
            <h2 id="examples-heading" className="font-display text-2xl text-ink md:text-3xl">
              See what people are making
            </h2>
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
          <div className="-mx-4 mt-4 md:mx-0">
            <CollabComposer embed hideHeading {...composerProps} />

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
