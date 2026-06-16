
# Collab Page Audit & v1 Upgrade

Goal: bring Collab up to Workshop's energy bar, and unlock one high-leverage viral loop — **Vouch**, where people you follow co-sign a Collab and you see "Vouched by 3 you follow" right on the card. Plus a Workshop-style **Boost** pin (one per user) to surface the Collabs the community cares about most.

## What's missing today (audit)

Looking at `collab.index.tsx` and `collab-card.tsx` against Workshop:

1. **Static feel.** Workshop has live pulses, presence dots, marquee. Collab is a flat grid of equal-weight cards.
2. **No social proof on cards.** You see author + comp + roles. You don't see *who else thinks this is worth doing*.
3. **No "right now" surface.** A Collab with a live Workshop running on it gets the same visual weight as one posted 6 days ago.
4. **Empty / discovery states are thin.** "Nothing open right now" is a dead end. No "people near you working on…" pulse.
5. **Logged-out is a generic feed.** No reason to sign up beyond "see more cards."
6. **Apply is the only action.** No lightweight signal between "scroll past" and "write an application."

## Scope (one viral loop + UI polish)

Three things, in order:

### 1. Vouch — the IRL viral loop

A Vouch is a one-tap public co-sign on a Collab post by someone other than the author.

- **Action**: signed-in user taps "Vouch" on any Collab. Adds a row. Lightweight, public, not an application.
- **On the card**: replace nothing; *add* a small row above the author line:
  - If viewer follows ≥1 voucher: `Vouched by @alex + 2 others you follow`
  - Else if vouches > 0: `Vouched by 4 people`
  - Else: hidden
  - Avatar stack of up to 3 (prioritize people the viewer follows).
- **On the detail page**: full voucher list with avatars + a "Vouch" button.
- **Notifies** the post author ("@alex vouched for your Collab"), creating a relationship signal we can later use for invites.
- **Logged-out behavior**: tapping Vouch opens an inline "Sign in to vouch" CTA — `@alex` becomes the implicit referrer if they shared the link. This is the viral wedge: shared Collab links → friends vouch → those friends are now in the product, attributed.
- **Anti-spam**: one vouch per (user, collab). Rate-limited via existing `rate_limits` table. Authors can't vouch their own post.

Why this is the right loop for v1:
- Maps to how IRL creative networks actually work ("you should do this with my friend Sam").
- Doesn't require new graphs — uses existing `follows`.
- Creates a public-count flywheel: posters share to get vouches, vouches make the post more credible, more credible posts attract better applicants.
- Sets up the next feature naturally (DM-an-application, "people you've vouched for" inbox).

### 2. Boost — Workshop pin pattern on the board

Same mental model the user just shipped on Workshop:
- **Anyone**: can Boost **one** Collab at a time (re-boosting replaces). Boosting ≠ applying.
- **Admin** (no per-board host concept on Collab — this is a community board): can pin multiple in order, for editorial promotion.
- **UI**: a "Boosted" strip above the grid showing up to 6 boosted Collabs. Subtle distinction from regular cards (a small `Boosted` chip + soft border accent). Empty state: hidden entirely.
- A Boost also implicitly counts as a Vouch (saves a tap; both signal "I care about this one").

### 3. Workshop-grade UI polish

Visual + interaction lifts borrowed directly from Workshop:

- **Live row at top** (when any Collab has `live_workshop_id`): a horizontal scrollable strip of currently-live Collab→Workshop rooms with the same pulse dot pattern as `room-prompt-marquee` / live indicators. Tap → jump straight into the Workshop. Sells the live product the moment you land.
- **Card upgrades** (`collab-card.tsx`):
  - Add Vouch row (see above).
  - When `live_workshop_id` is set, promote the Live badge: larger, animated, and the whole card gets a subtle border-gradient hover (mirror Workshop's `shadow-lift`).
  - Recent-activity dot: posts with a vouch or applicant in the last 24h get a small ` Active` chip.
  - Hover micro-interaction: roles chips lift slightly (Workshop's `whileHover y:-3` rhythm).
- **Empty state → invitation**: when the filtered grid is empty, instead of "nothing open" show "No open Collabs in {City} — start one and we'll notify the {N} creatives nearby" with the Post button.
- **Logged-out home (Collab Board)**:
  - Hero swaps from "Collab Board / What people are trying to make" → a live counter: `{N} open Collabs · {M} vouched today · {K} live right now in {City}`.
  - First card slot becomes a read-only Workshop peek (live marquee from one active room) → "This is what a Collab looks like when it goes live."
  - Sticky bottom CTA on mobile: "Sign in to vouch + apply" (instead of nav-only auth).

## Out of scope (intentionally)

- DM-an-applicant flow (separate ticket).
- Vouch decay / unvouch UI niceties beyond a basic toggle.
- Editorial admin tooling beyond Boost pin/unpin.
- Replacing the existing apply funnel.
- City pulse / IRL bring-a-friend SMS invite — keeping focus on the one loop we picked. Vouch already pulls IRL networks in via shared links.

## Technical notes

**New table — `collab_vouches`**
- `id`, `collab_post_id` (fk, cascade), `user_id` (fk auth.users), `created_at`.
- `UNIQUE (collab_post_id, user_id)`.
- RLS: anyone authenticated can `SELECT`; users can `INSERT` their own, `DELETE` their own. Author cannot insert for own post (trigger).
- Trigger updates a `vouch_count` on `collab_posts` and inserts a notification.
- GRANT SELECT to `anon` (counts are public on shared links), INSERT/DELETE to `authenticated`, ALL to `service_role`.

**New table — `collab_boosts`** (Workshop-pin analog for the board)
- `id`, `collab_post_id`, `user_id`, `is_admin_pin bool`, `sort_order int`, `created_at`.
- Partial unique index `(user_id) WHERE is_admin_pin = false` → enforces one-boost-per-user.
- Re-uses Workshop's `has_role('admin')` for admin pins.
- RLS + grants follow the `instant_room_pins` precedent already in this codebase.

**Server functions — `src/lib/collab-vouches.functions.ts`, `src/lib/collab-boosts.functions.ts`**
- `vouchCollab({ collabPostId })` / `unvouchCollab(...)`
- `boostCollab({ collabPostId })` / `unboostCollab(...)` / `reorderAdminBoosts(...)`
- All use `requireSupabaseAuth`. Boost auto-creates a Vouch if absent.

**Reads**
- Extend the existing `fetchPosts` select with `vouch_count`. Add a sibling query that fetches the viewer's followed-voucher avatars for the current page of posts (single batched query, not N+1).
- Add a "boosted" query for the top strip.

**Realtime**
- Subscribe `collab_vouches` + `collab_boosts` on the index page → invalidate queries. Same pattern as `workshop-collabs-panel`.

**Files touched**
- Migration: `collab_vouches`, `collab_boosts`, trigger, RLS, grants, realtime publication.
- New: `src/lib/collab-vouches.functions.ts`, `src/lib/collab-boosts.functions.ts`, `src/components/vouch-button.tsx`, `src/components/boosted-collabs-strip.tsx`, `src/components/live-collabs-strip.tsx`.
- Edit: `src/components/collab-card.tsx` (vouch row, live promo, active chip), `src/routes/collab.index.tsx` (strips, empty state, logged-out hero), `src/routes/collab.$slug.tsx` (Vouch button + voucher list).
- No Workshop code changes.

## Open question for after approval

Do you want **admin Boost pins** at all in v1, or just user-Boosts (one per person)? Admin pins are 30 minutes of extra work and useful for launch curation, but skippable if you'd rather let the crowd decide entirely.
