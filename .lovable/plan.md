## Lineup events — performers claim numbered slots from the event page

A new event kind where the host advertises a show (comedy night, band showcase, DJ set) and performers claim a numbered spot directly from the public event page. Built for Meta-ad traffic: a stranger can land on the page, claim slot #4, and finish signup within 5 minutes — or the slot releases back to the pool.

### Host experience (event creation)

A new event kind **"Lineup"** is added alongside the existing kinds. When picked, the event form reveals a Lineup section:

- **Number of slots** (1–50). Generates slots #1…#N.
- **Slot mode** — one of:
  - `open_claim` — anyone signed in can grab any open slot instantly.
  - `host_approval` — claims arrive as "Requested"; host confirms/declines from the event page or `/admin/lineups`.
- **Performer fields shown when claiming** (host toggles each):
  - Stage / act name (default: profile name)
  - Act type — `Comedian`, `Band`, `DJ`, `Other`
  - One link (Instagram / Spotify / set list)
  - Private notes to host (only host + site admin see)
- **Allow self-switch** to another open slot (default on).
- **Lock changes N minutes before start** (default 60).

Host can also manually add a performer to a slot (name + optional link) for acts they booked outside the system.

### Public event page

On a Lineup event, the page renders a **Lineup** panel under the hero:

- A numbered list `#1 … #N`. Each row shows: position, performer chip (avatar + stage name + act-type chip + link icon), or an **"Claim slot"** button if open.
- A "Requested — pending host approval" badge for `host_approval` events.
- A "Holding — 4:32 left" badge for slots in a soft hold.
- If the viewer holds a slot: a **My slot** card at the top with **Edit info**, **Switch slot**, **Release**.

### Claim flow (the Calendly-like piece)

1. Visitor clicks **Claim slot #4**.
2. A modal opens with the performer fields the host enabled.
3. **If signed in:** submit → slot is theirs (or "Requested" in approval mode). Done.
4. **If signed out:** they fill the form + email, hit Continue. Server creates a `soft_hold` row tied to that email, marks the slot held for **5 minutes**, and walks them into the signup flow with the email prefilled.
   - The lineup panel shows "Holding — 4:32 left" so other visitors can't double-claim.
   - When they finish signup and verify, the hold converts to a real claim under their new user id. Their performer fields are preserved.
   - If they bail or the timer expires, a background sweep (and any new claim attempt) releases the slot.
   - Same email can only hold one slot at a time; an IP+email rate limit prevents slot-squatting.

### Performer self-service (post-claim)

- **Edit info** — change stage name, act type, link, notes any time before the lock window.
- **Switch slot** — opens a chooser of open slots; one-click swap.
- **Release** — frees the slot; row goes back to open.

### Host / admin tools

- On the event page, when host or site admin is viewing, each slot row gets:
  - Approve / Decline (approval mode)
  - Remove performer
  - Move to a different slot
  - View private notes
- A new **`/admin/lineups`** route lists all lineup events across the site with filters (upcoming, by host, pending approvals) and per-event drill-in showing every claim, hold, release, and swap with timestamps — the "backend audit" the user asked for.

### Notifications

Best-effort, respect existing `notification_preferences`:
- Host: new claim, new approval request, performer released, performer switched.
- Performer: approval decision, host moved them, event reminder 24h / 2h.

---

## Technical section

### Schema (single migration)

- Extend enum `group_event_kind` with `'lineup'`.
- New enum `lineup_slot_mode` = `('open_claim','host_approval')`.
- New enum `lineup_act_type` = `('comedian','band','dj','other')`.
- New enum `lineup_claim_status` = `('open','soft_hold','requested','confirmed')`.
- New columns on `group_events`: `lineup_mode lineup_slot_mode`, `lineup_field_act_type bool`, `lineup_field_link bool`, `lineup_field_notes bool`, `lineup_allow_switch bool default true`, `lineup_lock_minutes_before int default 60`.
- New table `group_event_lineup_slots`:
  - `id`, `event_id` (FK cascade), `position int`, unique `(event_id, position)`.
  - `status lineup_claim_status default 'open'`.
  - `claimed_by uuid` (FK auth.users, nullable), `claimed_at timestamptz`.
  - `manual_performer_name text` (for host-added external acts).
  - `stage_name text`, `act_type lineup_act_type`, `link_url text`, `notes_to_host text`.
  - `hold_email citext`, `hold_expires_at timestamptz` (for soft holds).
  - `created_at`, `updated_at`.
- New table `group_event_lineup_audit` (host audit log): `id`, `event_id`, `slot_id`, `actor_user_id`, `actor_email`, `action text` (`claim|hold|release|switch|approve|decline|move|edit|manual_add|manual_remove`), `metadata jsonb`, `created_at`. Insert-only.
- RLS:
  - Slots: public SELECT (so the page renders for ad traffic), but `notes_to_host` and `hold_email` redacted via a view `group_event_lineup_slots_public` exposing only safe columns; the raw table is `TO authenticated` for the claimant, host (via group membership), and admins (`has_role`).
  - Audit: SELECT only for host + admins; INSERT only via server fn.
- GRANTs per the template's rules; `updated_at` trigger on slots.

### Server functions (`src/lib/lineup.functions.ts`)

All app-internal logic via `createServerFn`:
- `getLineupForEvent(eventId)` — returns slots from the public view + viewer's own private fields.
- `claimSlot({ slotId, performer })` — `requireSupabaseAuth`; respects `open_claim` vs `host_approval`; rejects if locked window passed; writes audit.
- `softHoldSlot({ slotId, email, performer })` — **no auth**; rate-limited per email+IP; inserts a 5-min hold; returns a hold token.
- `convertHoldOnSignup({ userId, email })` — called from the existing post-signup hook; promotes matching unexpired holds to the new user.
- `releaseSlot(slotId)` / `switchSlot({ fromSlotId, toSlotId })` / `updateMyPerformerInfo` / `cancelMyHold`.
- Host-only: `approveClaim`, `declineClaim`, `moveClaim`, `addManualPerformer`, `removeFromSlot`, `setLineupConfig`.
- A scheduled sweep server route at `/api/public/cron/lineup-sweep` (signed) that expires holds; also opportunistically swept on every read.

### Client

- Extend the event creation form (`group-event-form.tsx` or equivalent) with a Lineup section when kind = `lineup`.
- New `LineupPanel` component on the public event page (`group-events.$slug.tsx`) — list + claim modal + my-slot card.
- New `ClaimSlotDialog` reusing existing auth dialog patterns: signed-in → direct submit; signed-out → email + performer fields, then route to `/auth?next=…&claim=<holdToken>`.
- Host controls inline on each row (approve/decline/move/remove) gated by `useIsEventHost`.
- New route `src/routes/admin.lineups.tsx` (admin-only) with the audit drill-in.
- Realtime subscription on `group_event_lineup_slots` filtered by `event_id` so the panel updates live as others claim/release.

### Out of scope (for this pass)

- Paid spots / deposits.
- Set-length / time-based slots (we picked numbered positions).
- SMS reminders.
- Public waitlist for sold-out lineups (host can still add manually).

### Files

**Created:** migration; `src/lib/lineup.functions.ts`; `src/components/lineup-panel.tsx`; `src/components/claim-slot-dialog.tsx`; `src/components/host-lineup-controls.tsx`; `src/routes/admin.lineups.tsx`; `src/routes/api/public/cron/lineup-sweep.ts`.

**Edited:** event create/edit form, public event page route, `notifications-bell.tsx` (new kinds), admin nav, post-signup hook (hold conversion), `src/integrations/supabase/types.ts`.
