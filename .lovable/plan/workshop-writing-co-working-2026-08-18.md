# Workshop Writing Co-working

A second automated Workshop Event Program alongside Open House, using the same program table, materializer, cron, and admin control room. Writing only — no medium picker, no new scheduler, no new admin area.

## What already exists (reused as-is)

- `workshop_event_programs` table with `key`, `program_type`, cadence, horizon, lead time, duration, venue pool, template — plus `group_events.workshop_event_program_id` / `program_occurrence_key` for identity and dedup.
- Materializer `src/lib/events/workshop-programs.server.ts` (`materializeProgram`, `materializeAllPrograms`), invoked by `/api/public/events/materialize` and by "Top up now".
- Admin functions `src/lib/workshop-programs.functions.ts` (list, pause/resume, update, top up, cancel occurrence, cancel future) and the control room `/admin/workshop-events`.
- Co-working vocabulary and copy in `src/lib/events/coworking.ts`; venue registry, daypart eligibility and policy checks in `src/lib/events/workshop-venues.ts`; public panel `src/components/events/coworking-block.tsx`; event detail `src/routes/g.$slug.e.$eventSlug.tsx`; admin composer `src/routes/admin.events.tsx`.

## Smallest clean generalization

Today `planMonth` assumes one shape: a home base plus rotating venues in evening / weekend-afternoon windows. It becomes strategy-aware, keyed off the existing `program_type`:

- `open_house` → the current planner, byte-for-byte behavior, same seeds, same occurrence keys. Open House output must not shift.
- `writing_coworking` → a new daypart-rotation planner in the same module: for each monthly slot, compute a stable global ordinal from a fixed schedule anchor (`(monthIndex − anchorMonth) × events_per_month + slot`) and cycle Morning → Afternoon → Evening from it. Rotation depends only on the anchor and the slot, never on how many times the job ran, so top-up is repeatable.

Everything downstream — horizon counting, lead time, occurrence keys, `23505` idempotency, error reporting, cron, pause/resume, cancellation — stays exactly as it is.

### Slot rules for Writing Co-working

- Times from the existing daypart windows: Morning 9–12, Afternoon 2–5, Evening 6–9.
- Candidate venues for a slot: enabled in the program's venue pool, active in the registry, reviewed for Co-working, eligible for that slot's daypart, and passing `evaluateVenuePolicy` at the accepted maximum of 8. Rotate deterministically; avoid repeating the previous occurrence's venue when another safe option exists.
- Age, hours, power, walk-in and group-policy metadata are respected through the existing venue functions; automation never confirms a venue policy and never auto-publishes a review-required venue.
- No safe venue for a slot → skip it and record the reason in the program's existing `last_error` / attention state.
- Obama Presidential Center Café stays out of the pool.

## Program seed (idempotent migration)

One `INSERT ... ON CONFLICT (key) DO NOTHING` on `workshop_event_programs`:

- key `writing_coworking`, program_type `writing_coworking`, name "Workshop Writing Co-working"
- active, 4 events/month, horizon 8, lead 7 days, 180 minutes, America/Chicago
- group resolved the same way Open House resolves its Workshop-owned Chicago group
- venue pool = Co-working-eligible Chicago venues, each configured capacity 6 / overflow 2; no home base
- template: kind `coworking`, creative_category `writing`, format `in_person`, facilitation `hostless`, drop_in_allowed true, allowed_activities `["writing"]`, waitlist_enabled true, source Workshop, official true, tagline and description below

No event rows are inserted by the migration.

### Generated occurrence copy

- Title: `Workshop Writing Co-working · {Daypart} at {Venue name}`
- Tagline: "Bring something to write. Work quietly alongside other writers."
- Description: the quiet small-group writing paragraph (notebook, laptop, draft, research notes; no critique, reading, presentation or required conversation; drop in, find the group, buy something, work as long as you like).

## Public experience

Reuses the current Event page and RSVP flow. `CoworkingBlock` gains a writing variant, selected from the event's activities being exactly writing:

- Heading "A quiet writing session"; intro "People write independently, side by side. There is no critique round, presentation, or agenda."
- What to bring: notebook or laptop, draft or notes, power; plan to buy something from the venue.
- "Good for" shows only Writing.
- Unchanged: working window, daypart and hostless badges, venue info, power/Wi-Fi, first-come seating, group-size and attrition explanation, venue disclaimer, Who's here, Wall, Gallery, waitlist, `/events` Co-working and daypart filters.

RSVP note prompt becomes "What are you writing?" with placeholder "Revising chapter three…" for writing sessions, using the existing note field and visibility. The Co-working Wall suggestion "Working on" becomes "Writing today"; other arrival suggestions stay.

## Admin

- Manual Co-working creation defaults `allowed_activities` to `["writing"]`, shows Writing as a fixed activity instead of the multi-select, stops the venue picker overwriting activities with the venue's broad array, and uses the Writing tagline/description defaults. Daypart, age, hostless, drop-in, capacity, overflow, venue policy and arrival-note controls stay. Legacy activity values keep rendering on existing events; nothing is rewritten.
- `/admin/workshop-events` shows Writing Co-working as a second card with the existing controls. The hard-coded "Cancel future Open House events" label, its confirm dialog and success copy become program-aware ("Cancel future {program name} events").

## Launch

Migration seeds the program active, then the existing "Top up now" / cron path fills the horizon. Verify: one program row, 8 future occurrences all linked to it, dayparts rotating Morning → Afternoon → Evening, every occurrence `kind=coworking`, `creative_category=writing`, `allowed_activities=["writing"]`, capacity 6 / overflow 2; a second top-up inserts nothing.

## Tests

New focused tests beside the existing event tests: daypart rotation from the anchor, plan stability across repeated runs, venue daypart eligibility and review-gating, writing-only payload, and program-aware cancellation copy. Existing Open House / series / venue tests must pass unchanged.
