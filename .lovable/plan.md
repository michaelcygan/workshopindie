# Fix link previews: share images never render on Reddit, X, Facebook, iMessage

## Short answer to your question

Yes — a blog post's cover image is already wired into its social image. That part is fine.

The problem is the file format. Every Workshop share image is served by one endpoint
(`/api/public/og`) that returns an **SVG**. Verified on production right now: the response
for a published blog post comes back as `content-type: image/svg+xml`.

Reddit, X, Facebook, LinkedIn, Slack, Discord and iMessage all refuse SVG for link
previews — they only accept JPEG, PNG, GIF or WEBP. So the crawler fetches the image,
sees an unsupported type, and drops it. That's why your Reddit post had no thumbnail.

This affects every shared link on Workshop, not just blog posts: profiles, works,
events, collabs, city pages and the homepage all point at the same SVG endpoint.

## What to change

### 1. Point share images at the real cover file

When a post (or work, or event, or profile) already has a cover/avatar image stored as a
real JPEG/PNG, use that image URL directly as `og:image` and `twitter:image`. No
rendering step, no format conversion, nothing that can fail — it's the same file the page
already displays.

Blog covers today are a mix of Workshop storage uploads and external image hosts; both are
plain absolute https image URLs, so both work as-is.

### 2. Add a real branded fallback image

For pages with no cover (most collabs, workshops, city pages, the homepage), generate one
static branded PNG share card and use it as the fallback instead of the SVG endpoint. It
gets a proper Workshop-mark treatment rather than a blank card.

### 3. Retire the SVG endpoint from head tags

Leave the route in place so old shared links don't 404, but stop pointing `og:image` at it
from any page. Every route's share image becomes either the entity's own image or the
static fallback.

### 4. Add the tags crawlers want alongside it

`og:image:width`, `og:image:height`, `og:image:type`, and secure absolute https URLs, so
Reddit and Facebook size the card as a large preview rather than a thumbnail strip.

## Routes touched

- `/blog/$slug` — cover image, else fallback
- `/$username` (profiles) — avatar, else fallback
- work, event, collab, city, workshop detail routes — cover, else fallback
- `__root.tsx` sitewide default — static fallback PNG

## Trade-off worth naming

Using the cover file directly means the preview is the raw photo, not a composed card with
the title typeset over it. Composed cards would need a PNG renderer running in the edge
worker (satori + a WASM rasteriser), which is a heavier, riskier build. Raw covers get
working previews everywhere today; a composed-card renderer can come later as its own
piece of work if you want the typography.

## Technical notes

- Root cause verified: `src/routes/api/public/og.ts` responds
  `Content-Type: image/svg+xml` (production HEAD request confirms). `src/lib/og-card.ts`
  builds an SVG string deliberately, to avoid native binaries on Cloudflare Workers.
- Secondary issue in the same file: the cover is embedded as `<image href="…">` inside the
  SVG, and remote refs inside SVG are commonly not fetched by renderers — so even if a
  crawler accepted SVG, the photo would likely be missing.
- Blog `head()` in `src/routes/blog.$slug.tsx` also `preload`s that SVG as a high-priority
  image; that preload gets dropped with the change.
- After deploying, Reddit/Facebook/X keep serving the preview they already cached. Re-share
  after publishing, or force a refresh in each platform's link-preview debugger.
