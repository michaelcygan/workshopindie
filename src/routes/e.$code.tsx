import { createFileRoute, redirect, Link, useRouter } from "@tanstack/react-router";
import { resolveEventShortCode } from "@/lib/event-short.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/e/$code")({
  loader: async ({ params }) => {
    const resolved = await resolveEventShortCode({ data: { code: params.code } });
    if (!resolved) return { notFound: true } as const;
    throw redirect({
      to: "/g/$slug/e/$eventSlug",
      params: { slug: resolved.groupSlug, eventSlug: resolved.eventSlug },
      replace: true,
    });
  },
  component: ShortLinkPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl text-ink">Couldn't open that link.</h1>
        <p className="mt-2 text-sm text-ink-muted">{error.message}</p>
        <Button onClick={() => { reset(); router.invalidate(); }} className="mt-6 rounded-full">Try again</Button>
      </main>
    );
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-display text-2xl text-ink">This event link is no longer active.</h1>
      <Link to="/groups" className="mt-4 inline-block text-sm text-primary underline">Browse groups</Link>
    </main>
  ),
});

function ShortLinkPage() {
  // Almost never rendered — loader either redirects or throws.
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-display text-2xl text-ink">Event not found.</h1>
      <Link to="/groups" className="mt-4 inline-block text-sm text-primary underline">Browse groups</Link>
    </main>
  );
}
