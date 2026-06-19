
# Work as a three-state object

Goal: make a Work behave like a clean, public gallery page that compiles cleanly into a portfolio. Minimal in time, rich in attribution. Three states stay coherent: **URL → Thumbnail → Page**.

---

## 1. The Page (`/works/$slug`) — templated and simple

Keep the page lean. Same layout for every Work. The variable surface is **who made it, what it is, when it shipped** — nothing more on the chrome.

**Header (top to bottom):**
- Category chip · source-type chip · license chip *(today)*
- Title (display, large)
- Excerpt
- **Byline** — first 3 collaborators inline, `+N more` (today)
- **Date line** (NEW, minimal) — single row: `Published Jun 19, 2026 · from Workshop "Late Night Cuts"` (or `· from Collab post`, or no source clause if solo). This replaces the duplicated date in the meta strip below the embed.

**Media** — cover or embed (unchanged).

**Meta strip** — keep views + actions (Like / Save / Share / Report). Remove the duplicated date (now in header).

**Social proof** — Vouch + Boost (unchanged).

**Description** — long-form body (unchanged).

**Credits — cast strip** (unchanged, this is the heart of the page).

**Also made together** (unchanged).

**Comments** (unchanged).

That's it. No timeline, no provenance section, no "history" block. The single date line + optional `from Workshop X` link is the entire temporal story.

---

## 2. The Thumbnail (`WorkCard`) — modular slots

Today's `WorkCard` shows cover + title + category. Make it **modular** so it can fill different spaces (gallery grid, profile portfolio, event-attendee rail, "also made together", related works) without rewriting it.

New `WorkCard` props (all optional, default to today's behavior):
- `showAvatars?: boolean` — overlay up to 3 collaborator avatars bottom-left of the cover (stacked, ring-bordered). Pulls from existing `work.credits`.
- `showCounters?: boolean` — micro-row under title: `· 1.2k views · 24 ♥ · 3 vouches`. Already have the data on `WorkCardData`.
- `density?: "compact" | "default" | "hero"` — controls padding, title size, and which slots render. `hero` reserved for pinned portfolio slot.
- `showCategory?: boolean` (default true).

**Defaults per surface:**
- Gallery grid: cover + title + category (today).
- Profile portfolio grid: cover + title + category + counters.
- Profile portfolio **pinned hero**: cover + title + avatars + counters, larger.
- Event-attendee rail: cover + title + avatars (the "who's here" payoff).
- Also-made-together: cover + title + avatars.

No source badge ("from Workshop") on the card — keep it for the page only. The card is for scanning Work; the page tells the story.

---

## 3. The URL (share/unfurl) — cover-first OG

`works.$slug.tsx` already wires `og:image` to `cover_url`. Tighten:
- When `cover_url` is missing but `embed_url` is a YouTube/Vimeo link, derive a poster (YouTube `hqdefault`, Vimeo oEmbed thumbnail) at loader time and use that for `og:image`. Many video-only Works currently unfurl with no preview.
- Keep `twitter:card = summary_large_image` when any image resolves; fall back to `summary` only when truly none.
- Confirm `canonical` and `og:url` self-reference `https://workshopindie.com/works/${slug}` (already correct — verify after edit).

No generated "cast card" OG image in this pass. Cover-first as you chose.

---

## 4. Portfolio compile (profile page `/u/$username`) — pinned + grid

Today `/u/$username` lists a user's Works. Add **pinning** so the profile reads like a curated portfolio.

**Data:** add `pinned_at TIMESTAMPTZ NULL` on `work_credits` (per-user pin — the same Work can be pinned on each collaborator's profile independently). Cap at **6 pins per user**, enforced in the server fn.

**Work page — pin control:** small "Pin to my profile" button in the meta strip, visible only when the viewer is a credited collaborator. Toggles `pinned_at` on their own `work_credits` row. Shows current count `(3/6 pinned)`.

**Profile page layout:**
1. **Pinned row** — up to 6 Works, rendered with `<WorkCard density="hero" showAvatars showCounters />`. Two-column on desktop, single column on mobile. Sorted by `pinned_at desc`.
2. **All work grid** — chronological (published_at desc), `<WorkCard showCounters />`, includes pinned Works again (don't hide — pinned is a spotlight, not a filter).

Empty state for pinned row: "No pinned work yet. Open a Work you're credited on and tap Pin." (shown only on the viewer's own profile.)

---

## Technical section

**Files touched:**

- `supabase/migrations/<new>.sql` — add `pinned_at timestamptz null` to `public.work_credits`; index `(user_id, pinned_at desc nulls last)`; no policy change needed (existing `work_credits` policies cover own-row updates via `user_id = auth.uid()`; verify and add a narrow UPDATE policy if missing).
- `src/lib/works.functions.ts` — add `togglePinCredit({ creditId })` server fn: validates caller owns the credit, enforces 6-pin cap, sets/clears `pinned_at`.
- `src/lib/works.functions.ts` or `src/lib/seo-loaders.functions.ts` — extend `getWorkSeo` to derive a YouTube/Vimeo poster URL when `cover_url` is null and `embed_url` is set, so `head()` can pass it as `og:image`.
- `src/routes/works.$slug.tsx` —
  - Replace duplicated date in meta strip with single header date line: `Published {date} · from <Link>Workshop {name}</Link>` (fetch workshop title via existing `source_workshop_id` join in `fetchWork`).
  - Add `PinToProfileButton` in meta strip (renders only for credited viewer).
  - Update `head()` to use the derived poster fallback from the loader.
- `src/components/work-card.tsx` — add `showAvatars`, `showCounters`, `density`, `showCategory` props; render avatar stack overlay using existing `credits` shape; render counter micro-row.
- `src/routes/u.$username.tsx` — split list into "Pinned" row (query `work_credits` where `user_id = profile.id and pinned_at is not null` ordered desc, hydrate Works) and "All work" grid (existing query). Use `density="hero"` for pinned.
- `src/components/work-card.tsx` consumers that should opt into new slots: `EventAttendeeWork` (add `showAvatars`), `AlsoWorkedTogether` in `works.$slug.tsx` (add `showAvatars`).

**Out of scope (deferred):**
- Timeline / provenance section, version history, remix tree.
- Generated cast-card OG image, dynamic OG endpoints.
- Role-grouped portfolio ("Directed" / "Edited"), case-study long-form mode, drag-to-reorder pins.
- Pin animations and pin-from-card (pinning is page-only this pass).

**Risks / verifications:**
- Confirm `work_credits` has an existing UPDATE-own-row RLS policy; add one if not (this is the only DB-side gotcha).
- YouTube `hqdefault.jpg` works for public videos; for unlisted, fall back to no image.
- Cap enforcement is server-side; UI shows count but trusts server.

