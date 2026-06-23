## Pass 7 — Knit the new IA together

The 6-pass build is shipped and the nav refactor closed Pass 6. This pass makes the re-weighted flows feel earned: the dashboard gets used, finished actions point to the next one, and new surfaces stop rendering blank voids. Tight scope, no new tables, no migrations.

### 1. Wire In Progress into the daily loop

**Why:** the `/in-progress` dashboard exists but is buried under More. Without an ambient surface, nobody opens it.

- **Avatar badge (desktop top-nav + mobile You tab).** Add a small count dot to the avatar trigger showing `open tasks due ≤7d + workshops you're confirmed for next 14d`. Polls `getInProgress` via TanStack Query with `staleTime: 60_000`. Hidden when zero.
- **Signed-in homepage entry.** On `/`, when `user` exists and the bundle is non-empty, render a single "Pick up where you left off" card above the Pulse Rail: shows the top 1 task + top 1 workshop with one CTA each ("Open task" → workshop room; "Open workshop" → `/w/$slug`) and a "See all" link to `/in-progress`. Signed-out: render nothing (homepage stays as-is).
- New helper `useInProgressBadge()` in `src/hooks/` so the avatar and the homepage card share one query key.

### 2. Post-action "what's next" nudges

**Why:** users currently hit a dead end after the big actions. The new IA has obvious next steps; surface them inline.

Reuse the existing `become-host-nudge` / `create-collab-nudge` visual pattern (small inline card, dismissible, never modal). Three nudges:

- **After publishing a Work** (on the Work detail page, owner only, work.published_at within 24h): "Got collaborators? Credit them" → opens existing credit flow. Falls back to "Attach this to an upcoming Event you're in" when credits are already set.
- **After RSVPing 'going' to an Event**: replace the success toast with a persistent card on the Event page pointing to Photos + Companion ("Drop photos here after the event · Open the companion thread now").
- **After ending a Workshop session** (host only, session.ended_at within 7d, no work yet linked): "Publish what you made →" deep-links into `/work/new?from_session=<id>`. If a work *is* linked, swap to "Share the result" with a copy-link button.

Each nudge stores a dismiss flag in `localStorage` keyed by `nudge:<kind>:<entity-id>:<user-id>` so it doesn't nag.

### 3. Honest empty states + mobile home parity

**Why:** Pulse rail, In Progress, and Event Photos all render `null`/blank when empty — first-time users see a void where the most interesting surface should be.

- `home-pulse-rail.tsx`: empty branch renders a one-line prompt + two primary actions ("Follow a few people" → `/gallery`, "Post a Collab" → `/collab/new`).
- `/in-progress` page sections (tasks / workshops / collabs): each gets its own per-section empty with the right primary action ("Join a workshop", "Post a Collab", "Browse open calls").
- `event-companion-panel` photos tab: empty shows "Be first to drop a photo" + upload button (component already exists).
- **Mobile home parity.** Bottom tab bar has no home affordance — only the orange dot inside More. Add a left-most "Home" tab with the `●` mark (no wordmark — space-constrained) so mobile users have a one-tap path back to `/`. Shift the existing 5 tabs accordingly; if 6 is too tight, fold "More" into the avatar/You sheet.

### 4. Small refactor (bonus, only if it stays under ~15 min)

Extract the parallel-fetch + interleave pattern shared by `home-pulse-rail`, `in-progress.functions`, and `event-companion-panel` into a single `interleaveByRecency<T>(sources, key)` util in `src/lib/`. Pure function, no behavior change, removes ~50 lines of duplication. Skip if any caller has diverged enough that the abstraction would leak.

---

### Technical notes

- **No DB changes.** Everything reuses existing `workshop_tasks`, `workshop_participants`, `collab_posts`, `works`, `group_event_rsvps`, `event_photos`. No migrations, no new policies.
- **New files:** `src/hooks/use-in-progress-badge.ts`, `src/components/pickup-card.tsx`, `src/components/nudges/work-published-nudge.tsx`, `src/components/nudges/event-rsvp-nudge.tsx`, `src/components/nudges/workshop-ended-nudge.tsx`.
- **Edited files:** `src/components/top-nav.tsx` (avatar badge), `src/components/mobile-nav.tsx` (home tab + badge), `src/routes/index.tsx` (signed-in pickup card), `src/components/home-pulse-rail.tsx` (empty state), `src/routes/in-progress.tsx` (per-section empties), `src/routes/work.$slug.tsx` + `src/routes/g.$slug.e.$eventSlug.tsx` + workshop session page (mount nudges), `src/components/event-companion-panel.tsx` (photos empty).
- **Auth:** `useInProgressBadge` calls the existing `getInProgress` server fn (already gated by `requireSupabaseAuth`); used only in components, never in public-route loaders.
- **Out of scope (saved for later):** reverse provenance on Workshop/Collab pages (item 2 from the menu), the `usePulse` refactor beyond the small interleave helper, any new tables, any search/discovery work.

---

## Pass 8 — Reverse provenance

Tight close-out pass. The 4-item Pass 8 menu (reverse provenance, mobile brand parity, `usePulse` refactor, `interleaveByRecency` util) collapsed to the one item with real user-facing value — the rest were either already coherent (mobile nav has its Home tab) or pure code-shape refactors with regression risk and zero UX delta.

- **`getWorksBySource`** server fn in `src/lib/work-provenance.functions.ts`: public-read, accepts `{workshop_id?, collab_post_id?}`, returns minimal Work cards with author.
- **`<WorksBornHere />`** in `src/components/works-born-here.tsx`: shared rail, renders nothing when no public Works exist (no empty void), supports `excludeWorkId` so it never double-features a Work already shown elsewhere on the page.
- **Mounted** on `/workshops/$slug` (after `ShippedBanner`, no exclusion — the banner is the canonical one, the rail shows everything including community ships) and `/collab/$slug` (above the closing `</main>`, excluding `post.resulting_work_id` to avoid duplicating the hero Work).

**Deliberately skipped:**
- Mobile home pill / wordmark — bottom bar is already at 5 tabs, the Home tab + `●` mark already lands the brand. Adding a wordmark would crowd the layout.
- `usePulse` shared helper + `interleaveByRecency<T>` util — code-shape only, no UX delta. The current callers have diverged enough (different source counts, different ordering rules) that the abstraction would leak.
