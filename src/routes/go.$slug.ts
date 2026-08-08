import { createFileRoute } from "@tanstack/react-router";
import { resolveAndRecord } from "@/lib/tracking-links.server";
import { TRACKING_CLICK_PARAM } from "@/lib/tracking-links.shared";

/**
 * `/go/<slug>` — the public side of a tracking link.
 *
 * A server route, not a page: the visitor gets a 302 straight to the Workshop
 * destination with no render, no flash and no landing page. Any query params
 * they arrived with (UTM tags and friends) ride along, and a short-lived click
 * id rides with them so the client can upgrade the row to "member" once the
 * destination page confirms a session.
 */

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

function notFoundResponse(status: number, message: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex">` +
      `<title>Link unavailable — Workshop</title>` +
      `<body style="font:16px/1.6 system-ui;margin:15vh auto;max-width:32rem;padding:0 1.5rem;color:#1a1a1a">` +
      `<h1 style="font-size:1.25rem;margin:0 0 .5rem">${message}</h1>` +
      `<p style="color:#666;margin:0 0 1.5rem">This Workshop link isn't active.</p>` +
      `<a href="/" style="color:#3157E0">Go to Workshop</a></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", ...NO_STORE } },
  );
}

export const Route = createFileRoute("/go/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const slug = (params.slug ?? "").toLowerCase();
        const result = await resolveAndRecord(slug, request.headers);

        if (result.kind === "missing") return notFoundResponse(404, "Link not found");
        if (result.kind === "disabled") return notFoundResponse(410, "Link disabled");

        const incoming = new URL(request.url).searchParams;
        const target = new URL(result.destination, new URL(request.url).origin);
        // Carry the visitor's own params through; the link's own destination
        // params win so a configured destination can't be hijacked by a query.
        for (const [k, v] of incoming) {
          if (!target.searchParams.has(k)) target.searchParams.append(k, v);
        }
        if (result.clickId) target.searchParams.set(TRACKING_CLICK_PARAM, result.clickId);

        return new Response(null, {
          status: 302,
          headers: { Location: `${target.pathname}${target.search}${target.hash}`, ...NO_STORE },
        });
      },
    },
  },
});
