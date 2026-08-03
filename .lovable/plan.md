# Wave 5 — Last mile: retire "Lounge" from remaining screens and prune dead audio surfaces

Wave 4 cleaned settings, friends, DMs, notifications and the invite flow. A scan of the codebase shows the word "Lounge" is still visible to users in several places, and some standalone audio-room UI is still shipping even though Groups now own the live layer. Wave 5 closes those gaps. No table, function, or route file gets renamed, so existing links and audio rooms keep working.

## 1. Copy still showing "Lounge" to users

Confirmed remaining user-visible strings:

- `src/routes/lounge.$id.tsx` — the standalone room page: page title and meta, error/empty states ("This Lounge isn't here", "Lounge hit a snag"), loading text, toasts ("This Lounge ended.", "First Lounge — nicely done."), the rename affordance ("Name this Lounge"), the end-room confirm, and the Collab pin tooltip.
- `src/routes/index.tsx` — homepage meta description says "run Lounges".
- `src/routes/u.$username.tsx` — "Drop into a Lounge" button (links to `/lounge`, which now redirects) and the empty-state line "drop into a Lounge".
- `src/routes/collab.index.tsx` — meta description "open a Lounge on it" and the live strip caption "Lounges on these Collabs are running".
- `src/routes/collab.$slug.tsx` — "A Lounge artist" host fallback and "Try opening the Lounge or another share."
- `src/routes/collab.new.tsx` — pin-failure toasts referencing the Lounge.
- `src/routes/g.$slug.index.tsx` — mention label map renders `workshop: "Lounge"`.
- `src/components/workshop-presence-works-rail.tsx` — "In this Lounge".
- `src/components/workshop-tools-panel.tsx` — two retired-tool blurbs mention the Lounge.
- `src/routes/dms.index.tsx` — conversation context fallback "Re: Lounge".

All become "Group audio" / "audio room" / "live audio" depending on whether the sentence refers to the feature or to a specific room. Admin-only labels (`admin.engagement.tsx`, `admin.marketplace.tsx`) stay as-is — they name internal tables and are not member-facing.

## 2. Fix links that point at the retired destination

`/lounge` now hard-redirects to `/groups`, so any button still pointing there sends users through a bounce. The profile CTA in `u.$username.tsx` should link straight to `/groups` with wording that matches ("Find a Group").

## 3. Prune the standalone room UI

`src/routes/lounge.$id.tsx` still carries features Groups replaced: room renaming, "end this Lounge", and the Collab-post-and-pin dialog. Group-backed rooms already redirect to `/g/$slug`, so this page only serves legacy non-group rooms. The plan keeps the page joinable (audio + chat) and removes the ownership and moderation affordances that no longer have a home in the Groups model, so the page reads as a plain legacy audio room rather than a competing product surface.

If you'd rather keep the standalone page fully featured for legacy rooms, say so and I'll drop this section and only do the copy pass.

## 4. Verify nothing regressed

- Typecheck the app.
- Load a Group page and confirm the audio dock still joins and leaves.
- Load a legacy `/lounge/$id` room and confirm chat + audio still work after the prune.
- Grep for member-facing "Lounge" and confirm only internal identifiers remain.

## Technical notes

- Files touched are all presentation-layer routes and components; no server functions, migrations, or RLS changes.
- `PlusGateReason`, `loungeAudioQuotaCopy`, `instant_rooms`, `/api/public/lounge/sweep` and the `lounge_*` tables keep their names — internal only.
- Route files `lounge.tsx`, `lounge.index.tsx`, `lounge.$id.tsx` stay in place so external links continue to resolve.
