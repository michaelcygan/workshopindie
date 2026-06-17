# Groups v1 — Finishing Pass

Three remaining pieces from the Groups v1 plan, plus the polish needed to make Groups feel native everywhere a post is created or consumed.

## 1. Onboarding — "Pick 3 Groups"

Add a Groups step to `src/routes/onboarding.tsx`, placed right after the city/home-city step (city stays — it powers the nearby fallback).

- New step component `OnboardingGroupsStep` renders a search + grid of group cards (kind chips: City / Genre / Micro / Scene), highlighting the user's home-city group as a pre-selected suggestion.
- Min 1, recommend 3, no hard max. Continue button enabled at ≥1.
- "Skip for now" link → user lands in `/groups` later via a soft banner on home.
- Persists by calling `joinGroup` server fn per selection (batched in parallel).
- On completion, invalidates `["my-group-ids"]` so the rest of the app sees memberships immediately.

## 2. Group picker in post creation

Add a multi-select Groups picker to:
- `src/routes/works.new.tsx`
- `src/routes/collab.new.tsx`
- `src/routes/workshops.new.tsx`

Behavior (shared component `<GroupPicker value onChange max={3} />`):
- Loads the user's joined groups first (pre-selected), then "Add another group" search across all public groups.
- Max 3 selections. Chips with × to remove.
- On submit, after the primary entity insert returns its id, tag each selected group via `tagWorkInGroup` / `tagCollabInGroup` / `tagWorkshopInGroup` in parallel.
- Workshops form: add an `external_url` field that appears when "Hosted elsewhere" mode is selected (in-person / online / external link triad). Stored on `workshops.external_url` (column add if missing).
- Failure on a tag does not roll back the post — surface a soft toast: "Posted. Couldn't tag {group}, try from the group page."

Lightweight `group_added_to_post` notification fires only to the post's creator on each successful tag (mirroring the vouch-flow rule: keep notifications light, creator-only).

## 3. Group-aware feeds

Update the main reads to rank by joined groups:

**Gallery (`/gallery` and `/g/$slug/gallery`)**
- Signed-in with joined groups: union of works tagged into joined groups, ordered by `created_at desc` with a small recency-decayed boost score (existing boost/vouch counters).
- "Your groups" chip strip at the top: All • [Group A] • [Group B] … toggles a single-group filter.
- Signed-in, no groups: existing nearby-city fallback + soft "Join Groups to personalize" banner.
- Logged-out: unchanged worldwide-first.

**Collab board (`/collab`)**
- Same join-first union; "Your groups" chip strip mirrors gallery.

**Workshops index (`/workshops`)**
- Same join-first union; preserves the live/upcoming tab structure.

**Home (`/`)**
- "Your groups" section renders 1 rail per joined group (cap 5 rails, "View all" → `/groups`), each rail = latest works/collabs/workshops mixed, ranked by recency.

Implementation note: add a thin server fn `getJoinedGroupFeed({ kind, limit, cursor })` in `src/lib/groups.functions.ts` that does the union+rank server-side using the existing junction tables, so route loaders stay simple and SSR-safe (called from the component via `useServerFn` since it needs auth).

## 4. Small polish

- `work-card.tsx`, `collab-card.tsx`, `workshop-card.tsx`: render up to 2 tiny group chips (linked to `/g/$slug`) under the title when tags exist.
- `/g/$slug` group home: surface a "Post here" CTA (dropdown → New Work / New Collab / New Workshop) that deep-links into the new-post routes with `?group={slug}` so the picker pre-selects that group.
- `top-nav` / `mobile-nav`: add a small "Your groups" submenu under Groups (top 5 joined, then "All groups").

## Technical details

- **DB**: only additive — `workshops.external_url text null` if not present; no other schema changes (counters and triggers already shipped).
- **Server fns**: new `getJoinedGroupFeed` (auth-gated) in `groups.functions.ts`; reuse existing tag fns from picker submissions.
- **Notifications**: extend `notifications.functions.ts` insert helper to emit `group_added_to_post` (creator-only, idempotent on `(post_id, group_id)`).
- **No changes** to Workshop runtime, Collab runtime, vouch/boost flows, or the integration-managed auth layout.

## Files (expected)

- new: `src/components/group-picker.tsx`, `src/components/onboarding-groups-step.tsx`, `src/components/your-groups-chip-strip.tsx`, `src/components/group-chips-inline.tsx`
- edited: `src/routes/onboarding.tsx`, `src/routes/works.new.tsx`, `src/routes/collab.new.tsx`, `src/routes/workshops.new.tsx`, `src/routes/gallery.tsx`, `src/routes/collab.index.tsx`, `src/routes/workshops.index.tsx`, `src/routes/index.tsx`, `src/routes/g.$slug.tsx`, `src/components/work-card.tsx`, `src/components/collab-card.tsx`, `src/components/workshop-card.tsx`, `src/components/top-nav.tsx`, `src/components/mobile-nav.tsx`, `src/lib/groups.functions.ts`, `src/lib/notifications.functions.ts`
- migration: add `workshops.external_url` if missing

Approve to build.