import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/goodbye")({
  component: Goodbye,
  head: () => ({
    meta: [
      { title: "Account removed — Workshop" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Goodbye() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10 text-center">
      <h1 className="font-display text-3xl text-ink">Take care.</h1>
      <p className="mt-3 text-sm text-ink-muted">
        Your account has been scheduled for deletion. We don't share or sell your data.
        If you signed out by mistake, sign back in within 30 days and we can restore it.
        After that, it's gone for good.
      </p>
      <div className="mt-6">
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-full border border-border bg-surface px-5 py-2 text-sm text-ink hover:bg-muted"
        >
          Back to Gallery
        </Link>
      </div>
    </div>
  );
}
