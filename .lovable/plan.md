# Finish the Workshop → Lounge rename

The live-room feature is now **Lounge**. "Workshop" remains only as the platform brand (e.g. landing page brand title) and in admin/internal labels for the legacy scheduled-workshop archive table. Every other user-facing surface still saying "Workshop/Workshops" needs to be updated.

## Scope

Sweep every `.tsx`/`.ts` file under `src/` (excluding `routeTree.gen.ts`, `integrations/supabase/types.ts`, and `.functions.ts`/`.server.ts` server code where strings aren't user-visible) for the word "workshop" and rewrite UI-facing copy to "Lounge".

### Confirmed from screenshots
1. **Collab Board** (`src/routes/collab.index.tsx`) — "open a Workshop on yours" → "open a Lounge on yours".
2. **Groups join strip** (`src/components/groups-join-feed-strip.tsx`) — "live collabs and workshops" → "live collabs and Lounges".
3. **In Progress page** (`src/routes/in-progress.tsx`) — subtitle "the workshops you're in" → "the Lounges you're in"; section title "Workshops you're in" → "Lounges you're in"; empty state "active Workshop" → "active Lounge"; "Tasks for you" subtitle "@-mentioned in a Workshop" → "@-mentioned in a Lounge".
4. **Profile header** (`src/routes/u.$username.tsx`) — "Drop into a Workshop" → "Drop into a Lounge".
5. **Profile in-flight empty** (`src/routes/u.$username.tsx` or `empty-spark.tsx`) — "drop into a Workshop" → "drop into a Lounge"; button "Drop into a Workshop" → "Drop into a Lounge".
6. **Messages / DMs** (`src/routes/dms.index.tsx`, `new-message-dialog.tsx`) — "collabs and workshops" / "a collab or workshop" → "collabs and Lounges" / "a collab or Lounge".

### Additional sweep (same rule applied)
Apply the same replacement across all remaining UI files surfaced by ripgrep, including but not limited to:
- `top-nav.tsx`, `home-live-workshops-rail.tsx`, `live-workshops-rail.tsx`, `workshop-strip.tsx`, `workshop-tools-panel.tsx`, `workshop-screen-share-panel.tsx`, `enter-workshop-button.tsx`, `nudges/workshop-ended-nudge.tsx`, `groups-join-feed-card.tsx`, `groups-spark-card.tsx`, `host-first-run-tour.tsx`, `host-menu.tsx`, `host-room-events.tsx`, `claim-host-pill.tsx`, `cocreator-picker.tsx`, `event-share-sheet.tsx`, `event-promo-pass-banner.tsx`, `featured-events-*`, `friend-row.tsx`, `follow-button.tsx`, `message-button.tsx`, `applicants-panel.tsx`, `chat-polls.tsx`, `cc-consent-dialog.tsx`, `license-chip.tsx`, `adjacent-groups-rail.tsx`, `world-arcs.tsx`, `group-card.tsx`, `group/group-tab-bar.tsx`, `collab-card.tsx`, `age-gate.tsx`, `today-text.tsx`, `seo.ts`, `recent-rooms.ts` (display labels only).
- Routes: `lounge.$id.tsx`, `lounge.index.tsx`, `events.index.tsx`, `cities.index.tsx`, `cities.$slug.tsx`, `collab.$slug.tsx`, `collab.new.tsx`, `collab.claim.$token.tsx`, `dms.$conversationId.tsx`, `index.tsx` (landing — preserve brand mentions), `signup.tsx`, `onboarding.tsx`, `settings.tsx`, `refer.tsx`, `redeem.$code.tsx`, `me.tickets.tsx`, `me.friends.tsx`, `me.edit.tsx`, `in-progress.tsx`, `u.$username.tsx`, `w.$token.tsx`, `checkout.return.tsx`.

### What stays "Workshop"
- Brand name on landing/marketing surfaces (`routes/index.tsx` brand headline, hero, footer — "Workshop is…").
- Admin-only labels and routes (`admin.*`, `workshops.$slug.archive.tsx`, `workshops.$slug.tools*.tsx`) — these are the retired scheduled-workshop archive surfaces, gated/legacy, and not user-launch facing.
- Internal identifiers, DB column names, route filenames (`/workshops/*` redirect shims), `instant_rooms.kind = 'workshop'`, server-fn names, types, query keys, comments.
- Redirect routes already in place (`workshop.$id.tsx`, `workshops.*`).
- `medium-icons.ts` / `mediums.ts` / `categories.ts` if "workshop" appears only as a category slug (verify; rename label only if user-visible).

### Approach

1. Ripgrep every file with `workshop` (case-insensitive) in `src/`.
2. For each, edit only the **JSX text, button labels, toasts, aria-labels, placeholders, headings, descriptions, and SEO strings**. Keep identifiers, route paths, DB enums, query keys, type names, and code comments untouched.
3. Pluralization rule: "Workshop" → "Lounge", "Workshops" → "Lounges", "workshop" → "Lounge" (capitalized per existing brand-noun convention already used in copy like "Lounge", "Collab").
4. Preserve sentences referencing the **scheduled-event** concept ("Workshops, networking, open mics…" on landing) — those describe event types, not the live-room.
5. Verify with a final `rg -i "workshop"` pass: anything left should be brand mentions, admin, redirects, identifiers, or comments.

### Technical notes

- Pure copy change — no schema, RLS, route, or server-function changes.
- No new files, no deletions (legacy redirect routes already exist).
- After edits, typecheck/build runs automatically.
