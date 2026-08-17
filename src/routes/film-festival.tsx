import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/film-festival")({
  head: () => ({
    meta: [
      { title: "Film Festival — Workshop" },
      {
        name: "description",
        content:
          "Workshop's independent film festival. Details, submissions, and screening dates are coming soon.",
      },
      { property: "og:title", content: "Film Festival — Workshop" },
      {
        property: "og:description",
        content:
          "Workshop's independent film festival. Details, submissions, and screening dates are coming soon.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FilmFestivalPage,
});

function FilmFestivalPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 md:py-28">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
        Workshop
      </p>
      <h1 className="mt-2 font-display text-[32px] leading-tight tracking-tight text-ink md:text-[44px]">
        Film Festival
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
        We're putting this one together. Submissions, screening dates, and the full program will
        land here soon.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/events"
          className="rounded-full bg-ink px-4 py-2 text-sm text-background hover:opacity-90"
        >
          Browse Events
        </Link>
        <Link
          to="/blog"
          className="rounded-full border border-border px-4 py-2 text-sm text-ink hover:bg-muted"
        >
          Read the Blog
        </Link>
      </div>
    </div>
  );
}
