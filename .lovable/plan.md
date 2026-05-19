# Streamlining "Create a Work" — paste-a-link to portfolio

The core idea: a user should be able to **paste a link and have a Work**. The form should appear *already filled in*, not as a wall of empty fields. Then "Add another" so they can dump 10 back-catalog items in 5 minutes.

The current `/works/new` page is a long manual form. The `works` table already stores `embed_url`, `primary_url`, `cover_url`, `excerpt`, and `description` — so we don't need schema work, we need a metadata extractor and a redesigned flow.

---

## 1. New server function: `extractWorkFromUrl`

`src/lib/works-import.functions.ts` — `createServerFn` that takes a URL and returns:
- `title`
- `description` (short)
- `cover_url` (remote image URL — we'll proxy/rehost into the `work-covers` bucket on confirm)
- `embed_url` (iframe-safe URL, when supported)
- `provider` ("soundcloud" | "youtube" | "vimeo" | "spotify" | "bandcamp" | "instagram" | "tiktok" | "generic")
- `suggested_category` (audio → "music", video → "video", etc.)
- `primary_url` (the canonical URL, cleaned of tracking params)

Resolution strategy, in order:
1. **oEmbed** — YouTube, Vimeo, SoundCloud, Spotify, Flickr, TikTok all expose `https://<provider>/oembed?url=...&format=json`. Cleanest path. Gives title, author, thumbnail, and an `html` iframe we can parse for `embed_url`.
2. **Open Graph fallback** — fetch the URL, parse `<meta property="og:title|og:description|og:image|og:video">`. Covers Bandcamp, Substack, personal sites, GitHub README repos, Behance, Are.na, Dribbble.
3. **Provider-specific normalizers** for embeds we want to render inline (YouTube → `youtube.com/embed/<id>`, Vimeo → `player.vimeo.com/video/<id>`, Spotify → `open.spotify.com/embed/...`, SoundCloud → `w.soundcloud.com/player/?url=...`, Bandcamp → use their `EmbeddedPlayer` markup from the OG snippet).

Run server-side (CORS + HTML parsing belong on the server, never the browser). Use `fetch` + a small regex-based OG parser (no DOM lib needed — keep the bundle small for the Worker runtime).

Cover handling: the extractor returns the *remote* `cover_url`. On submit, a second server fn `rehostCoverFromUrl` downloads it and uploads to the existing `work-covers` Supabase bucket so we don't depend on hotlink-allowed CDNs. Falls back to keeping the remote URL if rehost fails.

## 2. Redesigned `/works/new`

Replace the current single-step form with two states on the same page:

**State A — Drop a link (default, ~90% of the path):**
- One big input: `Paste a SoundCloud, YouTube, Vimeo, Bandcamp, Spotify, or any link…`
- Below it, four small "examples" chips that prefill the input for users who don't have a link handy.
- Submit triggers `extractWorkFromUrl` → page transitions to State B with everything filled.
- A small text link below the input: *"Or start from scratch →"* to fall through to the manual form.

**State B — Confirm & publish:**
- Live preview card at the top (cover + title + provider chip + embed if available) — feels like Twitter's link card.
- Editable fields, all prefilled: title, excerpt (we generate from description), category (prefilled from `suggested_category`), description, primary URL, license.
- The cover thumbnail is shown with a "Replace" affordance using the existing `ImageUpload` component.
- Sticky bottom bar: **Publish Work**, **Save draft**, **+ Add another** (saves current as draft, returns to State A — this is the back-catalog flow).

**Manual mode** is the existing form, reached via the "Start from scratch" link. Don't delete it; some users will want it for things with no canonical URL.

## 3. Inline embeds on the Work detail page

`src/routes/works.$slug.tsx` currently selects `embed_url` but never renders it. Add an `<EmbedPlayer url={work.embed_url} provider={…} />` component above the cover image. Render in a 16:9 frame for video, a fixed 160px tall iframe for audio (SoundCloud/Spotify standard). Falls back to the cover image when `embed_url` is null.

`src/components/embed-player.tsx` — `<iframe loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups">`. Provider whitelist enforced (only known iframe hosts ever render).

## 4. Quick-add from profile (the back-catalog moment)

On the user's own `/u/$username` page, add a thin "+" pill next to "Publish a Work" labeled **"Drop a link"** that opens a small dialog containing State A. On submit, it pushes them into `/works/new?import=<encoded url>` so State B opens with everything ready. This gives the "paste 10 links, ship 10 Works" rhythm without leaving the profile.

## 5. Gallery card affordances

Tiny but high-impact:
- `WorkCard` shows a small play-triangle overlay when `embed_url` is present and the work is in `music`/`video` category.
- Provider chip in the bottom-left of the cover (YT/SC/VM/BC/SP) when `embed_url` exists. Tells visitors "this plays inline."
- Sort tab "Has embed" hidden behind the existing filter row — defer to v2 if scope creeps.

## 6. Honor-system note

No verification of ownership. Below the URL input on State A: a small line — *"Drop links to work you made or co-made. We honor what you claim — report misuse from the Work page."* The existing `ReportDialog` already covers takedowns.

---

## Files

- **add** `src/lib/works-import.functions.ts` — `extractWorkFromUrl`, `rehostCoverFromUrl` server fns.
- **add** `src/components/embed-player.tsx` — provider-whitelisted iframe renderer.
- **add** `src/components/import-from-url.tsx` — the State A input + chips (reused on profile dialog).
- **edit** `src/routes/works.new.tsx` — two-state flow, reads `?import=` query param to skip State A.
- **edit** `src/routes/works.$slug.tsx` — render `<EmbedPlayer>` above the cover when `embed_url` is set.
- **edit** `src/routes/u.$username.tsx` — "Drop a link" pill that opens the import dialog.
- **edit** `src/components/work-card.tsx` — provider chip + play overlay when embed present.

## Out of scope (intentionally, for v1)

- Ownership verification / claim disputes — honor system, report-driven.
- Pulling an artist's *whole* SoundCloud/YouTube channel in one shot — link-at-a-time keeps it honest and curated.
- Audio waveform rendering — providers' own embeds already do this.
- Auto-tagging collaborators from video credits — the existing `work_credits` flow stays manual.

## Technical notes

- oEmbed endpoints are public and CORS-permissive server-side; we still run from a server fn because some (Spotify, Instagram) require auth tokens we'd rather keep off the client.
- The extractor must time out fast (3s) and never throw — return a partial `{ primary_url, title: <hostname> }` so the flow still works on an unknown link.
- Cover rehost runs *after* publish-click, not during extract, so State A → State B is sub-second.
- Add a small allowlist of known iframe-safe hosts; never render arbitrary HTML from oEmbed payloads.
