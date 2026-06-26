## Goal

Finish the Lounge rebrand so "Workshop" refers only to the platform/brand. The live-room feature is "Lounge" everywhere a user can see it, and every Collab has its inherent private Lounge — no scheduling, no pairing UI, no "Add a Workshop" step.

## 1. Kill the "Add a Workshop" block on `/collab/new`

Every Collab already gets a private Lounge via `OpenLoungeButton` on the Collab page (owner + accepted members only). The pairing step is dead weight that contradicts the new model ("users should not be able to plan their own events").

In `src/routes/collab.new.tsx`:
- Remove `workshopMode`, `scheduledAt`, `workshopExpanded`, `openWorkshopFn`, and the entire collapsible "Add a Workshop" section (currently lines ~557–617).
- Remove the workshop pairing logic in the submit handler (the `workshops` insert + `live_workshop_id` update, and the inline `openWorkshopOnCollab` call).
- Remove the post-success "Join your Workshop" CTA. Success dialog gets one primary action: "View Collab" → `/collab/$slug`. (The Collab page itself surfaces "Open the Lounge".)
- Drop the now-unused `WorkshopOption` helper and the `openWorkshopOnCollab` import.

## 2. Rename user-visible "Workshop" → "Lounge" (live-room only)

These are visible strings only. Keep the brand "Workshop" everywhere it refers to the product/site.

Files and specific copy:

- `src/components/channel-view.tsx`
  - Dialog title "Workshop wrapped" → "Lounge wrapped"
  - Button "Join new Workshop" → "Join a new Lounge"
  - Toast "Dropped from the Workshop — you went quiet." → "Dropped from the Lounge — you went quiet."
  - Toast "Couldn't find a new Workshop" → "Couldn't find a new Lounge"
- `src/components/invite-to-workshop-dialog.tsx`
  - Rename file to `invite-to-lounge-dialog.tsx`, component to `InviteToLoungeDialog`.
  - "Pick one of your Workshops, or start a new one together." → "Pick one of your Lounges, or open a new one together."
  - "You aren't hosting any active Workshops." → "You aren't hosting any active Lounges."
  - "Start a Workshop" button → "Open a Lounge"
  - Update import sites (search `InviteToWorkshopDialog`).
- `src/components/enter-workshop-button.tsx` — visible label "Enter Workshop" → "Enter Lounge" (filename left as-is; rename can come in a separate sweep).
- `src/components/claim-host-pill.tsx` — tooltip "This Workshop already has managed rights" → "This Lounge already has managed rights".
- `src/components/groups-join-feed-card.tsx` — `kindLabel = "Workshop"` → `"Lounge"`; empty-state copy "workshops" → "Lounges".
- `src/components/home-live-workshops-rail.tsx` — fallback "Untitled workshop" → "Untitled Lounge". Rail header/visible labels swept the same way.
- `src/components/notifications-bell.tsx` — visible notification text for `workshop_starting`, `workshop_now_live`, `workshop_ran_without_you`, `workshop_live` switches to "Lounge" wording. (Notification kind strings on the DB stay; this is rendering only.)
- `src/routes/signup.tsx` — hero copy "Walk into a live Workshop" → "Walk into a live Lounge". Keep the 18+ error using brand "Workshop".
- `src/routes/__root.tsx` — meta description / OG description "live collaboration workshops" → "live Lounges". Title/site_name stays "Workshop".
- `src/components/hop-button.tsx` — comment "Hop to next Workshop" → "Skip to next Lounge".

Strings that explicitly mean the brand stay untouched: `__root.tsx` `<title>` / `og:site_name`, `settings.tsx` ("Workshop Plus", "Delete your Workshop account?", notification category "Workshop updates"), `pricing.tsx` ("Workshop Plus"), `refer.tsx`, `events.index.tsx` SEO, `checkout.return.tsx`, `redeem.$code.tsx`, `dms.index.tsx` SEO, signup 18+ toast.

## 3. Stop linking to the legacy `/workshop/$id` URL

`src/routes/workshop.$id.tsx` already redirects to `/lounge/$id`. Update the remaining callers to navigate directly to `/lounge/$id` (avoids a double-hop and a flash):

- `src/routes/collab.new.tsx` (post-success — being removed in step 1 anyway).
- `src/components/channel-view.tsx` line 331.
- `src/components/host-room-events.tsx` line 51.
- `src/routes/w.$token.tsx` line 60.
- `src/components/post-workshop-from-city-sheet.tsx` line 192.

Also update `src/routes/lounge.index.tsx` line 549 (`to="/workshops"`) → `to="/events"` (legacy `/workshops` is shimmed to Events).

## 4. Group tab id polish

`src/components/group/group-tab-bar.tsx` labels the tab "Lounge" but the id/URL token is still `"workshops"`. Rename the id to `"lounge"` and update the consumer in `src/routes/g.$slug.tsx` so URLs read `?t=lounge`. Keep a one-line back-compat shim that maps `?t=workshops` → `lounge` for any cached links.

## 5. Out of scope (intentional)

These stay untouched in this pass — they're under-the-hood identifiers, not user-visible:

- DB table/column names (`workshops`, `workshop_polls`, `workshop_id`, `live_workshop_id`, `source_workshop_id`).
- Server-function names (`openWorkshopOnCollab`, `hostInstantWorkshop`, `listMyHostableWorkshops`, `inviteFriendToWorkshop`).
- Notification `kind` strings stored in the DB.
- Route filenames `src/routes/workshop.$id.tsx`, `src/routes/workshops.*.tsx` (already redirect shims).
- localStorage/sessionStorage keys (`workshop:av-prefs`, `workshop:last-room`).
- Admin analytics labels in `admin.index.tsx` ("Workshops created", "Workshop apps") — they reflect the underlying tables; can be relabeled when the schema is renamed.

A follow-up migration can rename the DB primitives in one shot; doing it now would touch every server function and risk regressions right before launch.

## Verification

- Typecheck must pass after the rename + import-site updates.
- Click through: `/collab/new` no longer shows the Workshop block; submit posts a Collab and lands on `/collab/$slug` with the "Open the Lounge" CTA visible to the owner.
- `/g/<slug>?t=lounge` resolves; `/g/<slug>?t=workshops` still resolves via the shim.
- Open a live Lounge, leave it alone → "Lounge wrapped" dialog (not "Workshop wrapped").
- Friend's invite dialog says "Open a Lounge".
