
# Unify Workshop without complicating the UI

Goal: keep the homepage's two-card simplicity and the one-tap **Drop in** flow. Layer scheduling and Collab-linked Workshops underneath the same primitive so nothing new appears on the surface, but the connective tissue is there from day one.

## Mental model (unchanged from last plan, refined)

A **Workshop** is a small group sitting down to make something. Four ways in — same primitive each time:

1. **Drop in** — a live Workshop with an open seat right now (today's lounge experience)
2. **Open one on a Collab** — owner one-taps "Open a Workshop on this" → becomes leader of a live Workshop with the Collab as topic
3. **RSVP to a scheduled one** — a Workshop at a set time
4. **Show up IRL** — a scheduled Workshop at a venue, surfaced on city pages

The user sees the word "Workshop" everywhere. Live / Scheduled / IRL are filter chips, not separate products.

## UI guardrails (the part you flagged)

- Homepage two-card layout **does not change**. Still: **Drop into a Workshop** | **Post a Collab**.
- `/workshops` (renamed from `/instant` as the canonical entrypoint) stays the current screen: giant **Drop in** button, mic/cam check, "Live now" ticker. **2 clicks: home → Drop in → in a room.**
- A small **secondary strip** sits below the Drop In button (not above, not in the way): three quiet pills — **Live now (N)** · **Upcoming (N)** · **In {your city} (N)**. Tapping a pill swaps the panel below; the giant Drop In button stays put. This is the only new surface area on the Workshop tab.
- Nav stays four items: Workshop · Collab · Gallery · Cities. No "Scheduled" tab, no "Instant" tab.

## The Collab ↔ Workshop bridge (the viral loop)

On a Collab detail page, the owner gets **one new button**: **"Open a Workshop on this"**.

- One tap → creates a live Workshop, owner is leader, Collab is the topic (shown in the room header), paired room opens, confirmed applicants get a notification with a join link.
- Collab card on the Board gets a **"🔴 Live now — join"** chip whenever `live_workshop_id` is set. Anyone browsing Collabs can drop straight into the working session. This is the virality unlock: a Collab post becomes a live room you can walk into.
- When the leader ends the session, the Workshop closes back to the Collab; if they ship a Work from inside the room, the Collab auto-closes with `resulting_work_id` and credits the people who were present.

## Scheduled Workshops — the tricky one, solved simply

Scheduled = a Workshop with `starts_at` in the future and `mode = 'scheduled'`. From the user's POV:

- **Creating one** lives behind the existing **Post a Collab** flow, with a small toggle at the bottom: *"Set a time for this? (optional)"* — off by default. If on, the Collab auto-generates a Scheduled Workshop tied to it. No separate "create a workshop" page surfaced in nav. (The existing `/workshops/new` route stays for power users / admins.)
- **Discovering one** is the "Upcoming" pill on the Workshop tab — a quiet list of cards with time, host, topic, **RSVP** button.
- **RSVP** is one tap. T-minus 10 min, RSVPs get a notification; the card shows **"Starts in 8m — open room"** which navigates straight into the paired live room.

### What happens if the organizer doesn't show

This is the bulletproofing you asked for. Rules (server-enforced):

1. At `starts_at`, the paired room flips to `active` and **any RSVP'd participant can enter** — leadership is not required to start.
2. If the host hasn't joined by `starts_at + 10min`, the first RSVP'd participant to enter is promoted to **acting leader** (silent — no modal, just a small "You're hosting" chip in the room header).
3. If by `starts_at + 15min` **nobody** has entered, the Workshop is auto-converted to a **live drop-in Workshop of that medium**: it disappears from "Upcoming," appears in "Live now" with the original topic, and anyone browsing that medium can drop in. The RSVP'd participants get a one-time "Your Workshop turned into a drop-in — join now" push.
4. The original host gets a soft notification ("Your Workshop ran without you — it's still live, jump in") so they don't feel punished.

This means a scheduled Workshop **never dies silently** — it always becomes a useful live room. No empty rooms, no broken promises.

## Solo-user viability (1 user case)

Already mostly there via `GuestApplyDialog`. Two small reinforcements:

- The "Post a Collab" success screen gets a **"Share your call"** sheet (already exists via `ShareCollabSheet`) auto-opened, with copy emphasizing *"Logged-out friends can apply in one tap — send this link."*
- Empty-state on `/workshops` (no one live) shows: *"No one's live right now. **Post a Collab** — anyone with the link can apply, no account needed."* — turns dead air into a path to action.

## Schema delta (one migration)

```sql
ALTER TABLE workshops
  ADD COLUMN topic_collab_post_id uuid REFERENCES collab_posts(id) ON DELETE SET NULL,
  ADD COLUMN auto_converted_at timestamptz,
  ADD COLUMN acting_leader_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE collab_posts
  ADD COLUMN live_workshop_id uuid REFERENCES workshops(id) ON DELETE SET NULL;

CREATE INDEX idx_workshops_topic_collab ON workshops(topic_collab_post_id);
CREATE INDEX idx_collab_posts_live_workshop ON collab_posts(live_workshop_id);
```

`mode` (existing text col) gains `'live'` alongside `'scheduled'`.

## Server functions (new)

- `openWorkshopOnCollab({ collabPostId })` — owner-only; creates live workshop, pairs room, notifies confirmed applicants, returns `{ workshopId, roomId }`.
- `convertScheduledToLive({ workshopId })` — idempotent; called by a 15-min grace job (pg_cron hitting `/api/public/workshops/sweep`) and by the room itself on first-entry checks.
- `claimActingLeader({ workshopId })` — first-RSVP-to-enter after host grace window.
- `rsvpToWorkshop({ workshopId })` / `cancelRsvp` — reuses existing `workshop_participants` with status `confirmed`.

## Build order (small, shippable steps)

1. **Schema migration** + index updates.
2. **Collab → Workshop bridge**: `openWorkshopOnCollab` server fn + button on `collab.$slug.tsx` (owner only) + "Live now" chip on `CollabCard`.
3. **Workshop tab secondary strip**: Live · Upcoming · In {city} pills on `/instant` (rename route alias `/workshops` → same screen, keep `/instant` redirect). The giant Drop In button stays.
4. **Scheduling toggle on Post a Collab**: optional `starts_at` field; on submit, creates linked scheduled Workshop.
5. **No-show safety net**: pg_cron + `/api/public/workshops/sweep` endpoint that runs `convertScheduledToLive` for any scheduled Workshop past `starts_at + 15min` with 0 entries. `claimActingLeader` wired into room-join.
6. **Solo-user polish**: auto-open `ShareCollabSheet` on collab create; empty-state copy on Workshop tab.

## What does NOT change

- Homepage hero, the two cards, nav, the Drop In screen, the `ChannelView` room UI, all auth/RLS/payment/age/gallery code.
- `/workshops/new` (full scheduling form) stays for admins; not surfaced in nav.
- Mediums work from the last batch.

## Acceptance checks

- Homepage → Drop in → in a room = 2 clicks. ✓
- Collab detail (as owner) → "Open a Workshop on this" → in a room = 2 clicks. ✓
- Scheduled Workshop with no host at T+15 → automatically becomes a live drop-in (verify via cron sweep). ✓
- Solo user with no other users online → can post a Collab and share a link where logged-out friends apply. ✓ (already works; we just surface it)

---

Want me to start with steps 1 + 2 (migration + Collab → Workshop button + Live chip), then come back for the Workshop-tab pills and the no-show sweep?
