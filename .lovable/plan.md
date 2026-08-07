# Wave 5 — Transactional lifecycle transitions

Two moments in Workshop today are multi-step sequences that can half-finish: opening a Workshop on a Collab, and turning a live room into a Collab. Each performs five to twelve separate writes with the privileged key and no transaction, so a failure or a double-click in the middle leaves stranded state — a Workshop with no room, a room stamped "promoted" with no Collab behind it, or two Workshops for one Collab.

This wave moves the core of both transitions into single Postgres operations. No product behavior, copy, or UI changes.

## What changes for people using Workshop

- Opening a Workshop on a Collab either fully works or does nothing — never a Workshop you can't enter.
- Double-tapping either button can't create a second Workshop, a second Collab, or a duplicate room.
- Creating a Collab from a live room now runs the same community-standards check as every other place text is written; today the title and pitch skip it.
- Everything else — invites, notifications, tools/docs/links carried forward — behaves exactly as it does now.

## Technical detail

### 1. Uniqueness guarantees (migration)

- Partial unique index on `workshops(topic_collab_post_id)` where the column is set and status is not `archived`/`canceled` — one live Workshop per Collab.
- Partial unique index on `workshops(source_instant_room_id)` where set — one promotion per room.
- (`instant_rooms(workshop_id)` uniqueness already landed in Wave 4.)

Both are checked for existing violations before creation; if any exist they are resolved in the same migration by keeping the oldest row.

### 2. `open_workshop_on_collab(_collab_post_id uuid)` — SECURITY DEFINER, `authenticated` only

One transaction: locks the Collab row, verifies `auth.uid()` is the owner, returns the existing Workshop + room when already linked and live, otherwise inserts the Workshop (same fields, city-scope rules, and 2h window as today), links `collab_posts.live_workshop_id`, inserts the host participant row, and inserts the paired `instant_rooms` row. Returns `(workshop_id, slug, room_id, created)`.

Outcome codes instead of raw errors: `not_found`, `forbidden`, plus the success row.

### 3. `promote_room_to_collab(_room_id uuid, _title text, _pitch text, _license_label text)` — SECURITY DEFINER, `authenticated` only

One transaction: locks the room, short-circuits when already promoted (returns existing pointers, `created = false`), authorizes host-or-currently-present, inserts the Workshop, inserts the paired Collab post, backlinks `topic_collab_post_id`, stamps `promoted_at` + `source_instant_room_id`, and inserts the host participant. Returns `(workshop_slug, collab_slug, workshop_id, created)`.

The Collab insert becomes part of the transaction rather than today's "non-fatal, log and continue" path, so a promoted room always has its Collab.

### 4. Server functions become thin

`src/lib/collab-workshop.functions.ts`:

- `openWorkshopOnCollab` — moderation pre-check unchanged, then one RPC call, then the applicant notifications (best-effort, only when `created`).
- `createCollabFromRoom` — add `moderateOrThrow` on title and pitch via `@/lib/moderation/service.server` (currently missing; `collab_posts` has no moderation trigger), then one RPC call, then the existing best-effort follow-ups guarded by `created`: copy-forward of tools, tool items, docs, drive links, list-items-to-tasks, plus join invites and notifications.
- Both call through `context.supabase` (the signed-in user) rather than the service-role client, so identity is derived from the token, not from a parameter. The follow-up copy-forward steps keep using the admin client where they cross RLS boundaries.

### 5. Small fix alongside

`src/routes/groups.index.tsx` defines `SORT_VALUES` without exporting it while `validateSearch` references it, which breaks the shared-route chunk in preview (`does not provide an export named 'SORT_VALUES'`). Move the constant and its type into a tiny module (`src/lib/groups/sort.ts`) and import it.

## Verification

- Typecheck clean.
- Security linter re-run; new functions revoked from `PUBLIC`/`anon`, granted to `authenticated` and `service_role`.
- Direct database read-back after exercising both flows in preview: exactly one Workshop per Collab, one room per Workshop, one Collab per promoted room, and repeat clicks return the same ids.
- Confirm the moderation path rejects a blocked title on room promotion.
