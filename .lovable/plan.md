
# Distillation Pass — 2027 v1

Two audits agree: the route map is solid, but there's a thick band of pre-rebrand cruft (`/workshops/*` legacy links, off-by-default flag code, orphan components) and a few real bugs (`/events/new` missing, `/workshops/lobby/new` button-to-nowhere).

The five primitives — **Post a Collab · Go to an Event · Join a Group · Drop into a Lounge · Curate a Work** — are clean. This pass removes everything not in service of them.

## 1. Bugs — fix first

- **`/workshops/new` redirects to `/events/new` which doesn't exist.** Change the redirect target to `/events` (we never built an external event-creation flow; events are posted from inside a Group).
- **`LobbiesSection` "Start a Draft" → `/workshops/lobby/new`** (route deleted). Component is also unused. Delete the component.
- **`/lounge` "Open library →" links to `/workshops`** (which redirects to `/events`). Remove the link; the "Recent Lounges" rail already shows what matters.

## 2. Legacy `/workshops/$slug` link sweep

The `/workshops/$slug` page (`workshops.$slug.tsx`) is the old scheduled-workshop detail — *not* the Lounge. Several surfaces still link to it as if it were a Lounge:

| File | Fix |
|------|-----|
| `in-progress.tsx` "Lounges you're in" cards | Link to `/lounge/$id` instead |
| `dms.$conversationId.tsx` "Re: {title}" chip | Link to `/lounge/$id` |
| `u.$username.tsx` past-rooms blocks (3 spots) | Link to `/lounge/$id` |
| `enter-workshop-button.tsx` (used on `/works/$slug`) | Link to `/lounge/$id`; rename to `EnterLoungeButton` |
| `workshop-strip.tsx`, `workshop-live-toast.tsx` | Link to `/lounge/$id` or remove (see §3) |

After this sweep, `/workshops/$slug` is only reachable through its own scheduled-workshop flow on city pages, which is its actual purpose.

## 3. Retire flag-off features for v1

`src/lib/flags.ts` has three flags hardcoded `false`. Delete the gated code rather than carrying it dark:

- **`BOOSTS`** — delete `boost-button.tsx`, `work-boost-button.tsx`, `boosted-works-strip.tsx`, the "Boosted" strip on `/collab`, and `collab-boosts.functions.ts` / `work-boosts.functions.ts`. Drop `collab_boosts` and `work_boosts` table reads from feed queries. (Keep the tables themselves — cheap, may revive post-launch.)
- **`VOUCHES`** — delete `vouch-button.tsx`, `work-vouch-button.tsx`, and the `useVouchersForPosts` call on `/collab`. Both buttons already have zero imports.
- **`RECORDER_PERSONAS`** — delete `components/recorder/persona-tabs.tsx`. Flag isn't even checked anywhere; pure dead code.

Then delete the `FLAGS` object entirely — only one flag system survives (`useFeatureFlag` against the `feature_flags` table, which is what admin/ops uses).

## 4. Consolidate the two Lounge strips on `/lounge`

`lounge.index.tsx` renders `WorkshopStrip` (queries `workshops` table) AND `LiveWorkshopsRail` (queries `instant_rooms`) back-to-back. Keep `LiveWorkshopsRail` — it's the live truth. Delete `WorkshopStrip`.

## 5. Consolidate Lounge entry server fns

`instant.functions.ts` exports `joinLounge`, `joinMediumLounge`, `hostInstantWorkshop`. Merge `joinMediumLounge` into `joinLounge` with optional `medium`. Rename `hostInstantWorkshop` → `hostLounge` (internal only, but it leaks into logs).

## 6. Orphan components — delete

Zero imports across the codebase:
- `lobbies-section.tsx`
- `vouch-button.tsx`, `work-vouch-button.tsx`, `work-boost-button.tsx`, `boost-button.tsx` (after §3)
- `recorder/persona-tabs.tsx`
- `nudges/workshop-ended-nudge.tsx`

Single import but stale brand — rename:
- `invite-to-workshop-dialog.tsx` → `invite-to-lounge-dialog.tsx` (update copy)
- `post-workshop-from-city-sheet.tsx` → keep route purpose, audit copy, ensure it posts a real Event (Group event) not a legacy workshop

## 7. Copy + storage-key sweep on `/lounge`

In `lounge.index.tsx`: rename `WorkshopPreflight` → `LoungePreflight`; rename localStorage keys `workshop:av-prefs`, `workshop:opened-once`, `workshop:last-room`, sessionStorage `workshop:last-room` to `lounge:*` (one-time migration: read old key, write new). React-query key `workshop-recap-24h` → `lounge-recap-24h`.

Also fix the "Workshop" string fallbacks in `dms.$conversationId.tsx` (use "Lounge") and `nudges/workshop-ended-nudge.tsx` if kept.

## 8. Settings ↔ Profile redundancy

- Remove the read-only profile name/avatar block from `/settings` (`settings.tsx:794-871`); replace with a single "Edit profile →" link to `/me/edit`.
- Add "Edit profile" to the top-nav avatar "My stuff" submenu so users don't have to detour through `/me`.

## 9. Delete dead lib files

- `cities.functions.ts` — zero references. Confirm no edge function calls it, then delete.
- After §3, also delete: `collab-boosts.functions.ts`, `work-boosts.functions.ts`, `collab-vouches.functions.ts`, `work-vouches.functions.ts`, `recorder-personas.functions.ts`.

## 10. Delete legacy shim routes

The `/workshop/*` shims (`workshop.tsx`, `workshop.index.tsx`, `workshop.$id.tsx`) and `/workshops/lobby/new` shim have served their bookmarks-grace purpose post-rebrand. Keep `/workshops/$slug` (real scheduled-workshop page) and the `/workshops` → `/events` redirect. Delete the `/workshop` (singular) shims — the rebrand is months old now.

## Out of scope (call out, do not touch this pass)

- **DMs vs in-room chat** (`messages` vs `instant_messages`) — intentionally separate systems. Audit found no actual user confusion; just add a one-line code comment in each.
- **Notifications bell vs DM bell** — verify (don't refactor) that `notifications` table doesn't double-fire for new DMs.
- **`workshops` table vs `instant_rooms` table** — these are different products (scheduled IRL workshops on city pages vs drop-in Lounges). Leave the parallel data models; the route boundaries already separate them. Just keep the link audit (§2) clean.
- **`workshop_sessions` / `workshop_session_demos` / `workshop_session_tracks` tables** — orphaned in app code but a DB migration is a separate decision; leave for a later DB cleanup pass.

## Risk

Mostly delete-only changes. The two non-trivial edits are the link sweep (§2 — straightforward find/replace, but every site needs eyes on params) and the `WorkshopStrip` removal (§4 — verify `LiveWorkshopsRail` already covers the same empty/loading states).

## Sequencing

1. Bugs (§1) — single commit, ships independently.
2. Link sweep (§2) + copy/keys (§7) — single commit.
3. Flag retirement (§3) + orphan deletions (§6) + dead libs (§9) — single commit.
4. Lounge consolidation (§4, §5) — single commit.
5. Settings polish (§8) + shim deletion (§10) — single commit.
