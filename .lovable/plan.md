## Wave 0 findings (already done — analysis only)

I inventoried the code and counted every legacy table in production. The headline result changes the risk profile of this whole project:

**All LegacyWorkshop data is empty.**

| Table / relationship | Rows |
| --- | --- |
| `workshops`, `workshop_participants`, `workshop_join_invites`, `workshop_applications` | 0 |
| all other 17 `workshop_*` tables (sessions, docs, tools, tasks, polls, drive, board, messages, roles) | 0 (except `workshop_links` = 1) |
| `works.source_workshop_id` not null | 0 |
| `standing_meetups`, `meetup_occurrences` | 0 |
| `work_vouches`, `work_boosts`, `collab_vouches`, `collab_boosts` | 0 |
| `group_today_posts`, `group_today_pins` | 0 |
| Active: `instant_rooms` 74, `groups` 71, `works` 12, `collab_posts` 3, `group_events` 1, `lounge_audio_events` 64 | — |

Consequences: **no historical data migration is required** (Wave 7 collapses to code-only), and destructive schema cleanup carries near-zero data risk — but it is still sequenced last, behind code removal, with counts re-confirmed at the time.

Second key finding: **`instant_rooms` already has `group_id`, `collab_id`, `workshop_id`, and `source_workshop_id` columns.** The Lounge room table is the canonical room system; Wave 2 uses `instant_rooms.group_id` rather than inventing `lounge_rooms`.

Third: confirmed real defects — `me.friends.tsx` and `settings-menu-button.tsx` link/navigate to `/auth`, which is not a route in `src/routes/` (the route is `/login`). `invite-to-workshop-dialog.tsx` navigates to `/lounge` with an `inviteUserId` param the Lounge search schema does not declare.

Classification of the ~40 files matching "workshop": brand/copy (retain, e.g. `__root.tsx`, `pricing.tsx`, `settings.tsx`), generated (`types.ts`, `routeTree.gen.ts` — regenerate, never hand-edit), compatibility URLs (`/workshops/*`, sitemap — retain as redirects), active legacy dependencies (`lobby.functions.ts`, `collab-workshop.functions.ts`, `workshop-*.functions.ts`, `enter-workshop-button.tsx`, `invite-to-workshop-dialog.tsx`, `invite-friends-panel.tsx`, `workshop-tools-panel.tsx`, `post-workshop-from-city-sheet.tsx`, `workshops.sweep.ts`, `workshops.*.tsx` routes).

---

## Wave 1 — Low-risk correctness and terminology

- Fix `/auth` → `/login` in `me.friends.tsx` and `settings-menu-button.tsx`.
- Remove the unsupported `inviteUserId` search param usage (superseded in Wave 2).
- Strip camera/video remnants from `use-media-room.tsx`, `media-panel.tsx`, `channel-view.tsx`, `lounge.$id.tsx` — keep all microphone/audio-device code untouched.
- Remove imports/helpers proven dead by static analysis only.
- Rename clearly-legacy local variables toward `legacyWorkshop`. No brand copy touched, no repo-wide replace.

DB: none. Accepts when build passes, no camera permission prompt in Lounge, public routes resolve.

## Wave 2 — Real Group Lounges + Lounge invitations

- Persist `instant_rooms.group_id` when a Lounge is opened from a Group; surface active Group rooms in Group Today and on the Group page; return-to-Group navigation.
- Replace `workshop_join_invites` writes (`friends.functions.ts`, `lobby.functions.ts`, `collab-workshop.functions.ts`, `lounge.$id.tsx`, `invite-friends-panel.tsx`) with an invitation bound to a specific `instant_rooms.id`, notifying the invitee and deep-linking to that room; invalid once the room closes.
- DB: one additive migration — `lounge_invitations` (room_id, inviter, invitee, status, expires_at) with GRANTs + RLS, plus an index on `instant_rooms(group_id, status)`. No drops.

Accepts when a Group Lounge appears in its Group, an invite opens the exact room, and zero writes hit legacy invite tables.

## Wave 3 — Retire Vouch and Boost

Remove vouch/boost from ranking, sorting, selects, components, hooks, server functions, admin reporting (`gallery.tsx`, `works.$slug.tsx`, `collab.index.tsx`, `collab.$slug.tsx`, `work-card.tsx`, `collab-card.tsx`, `world-arcs.tsx`, `admin.marketplace.tsx`, `mcp/tools/search-works.ts`). Ranking falls back to recency + reactions + comments + views + featuring. Columns/tables stay until Wave 9.

## Wave 4 — Consolidate scheduled gatherings

`standing_meetups` and `meetup_occurrences` are empty; homepage and `cities.index.tsx` read them. Point both at the canonical `group_events` + `event_series` recurrence infrastructure and mark the meetup source archived. No data migration needed. Deleting the tables is deferred to Wave 9.

## Wave 5 — Canonical creative taxonomy

One shared config module (top-level Music, Film & Video, Writing, Visual Art, Games & Tech, Performance, Audio, Design, Other + subtypes), with a legacy alias map (`film`→`film_video`, `visual`→`visual_art`, `build`→`games_tech`) normalized at the data boundary. Existing enum values stay valid; filters and URLs keep working. Components stop declaring their own arrays.

## Wave 6 — Group Posts evaluation (report first)

`group_today_posts` and `group_today_pins` are both empty; Today is the live surface. I will report usage, notification/moderation/feed dependencies, and a recommendation before any removal. No code changes without your sign-off.

## Wave 7 — Historical LegacyWorkshop relationships

Zero works carry `source_workshop_id`, so there is nothing to translate. Work: remove the "Enter Workshop" affordance (`enter-workshop-button.tsx`, `work-provenance.functions.ts`) rather than leaving dead doors, keep contributor credits untouched, and replace legacy workshop metrics in admin analytics with Lounge rooms/participants/minutes, Collabs, applications, Works published, Group activity, RSVPs, blog publications, Plus conversions.

## Wave 8 — Remove legacy application dependencies

Delete LegacyWorkshop routes, components, server functions, the `workshops.sweep.ts` job, notifications and feature flags, once Waves 1–7 prove nothing reads or writes them. Keep `/workshops/*` compatibility redirects. Regenerate `routeTree.gen.ts` and `types.ts` through tooling.

## Wave 9 — Destructive schema cleanup

Only after logs show no legacy access. Re-confirm row counts, export any non-zero table (`workshop_links`), then drop in small single-purpose migrations: the 21 `workshop_*` tables, vouch/boost tables, meetup tables, `instant_rooms.workshop_id` / `source_workshop_id`, `works.source_workshop_id`, `workshop_count`, related RPCs/triggers/policies/indexes. Brand config, URLs, metadata, and copy are explicitly out of scope.

## Performance and maintainability pass (after Wave 9)

Lazy-load below-fold homepage modules, gate global helpers (presence heartbeat, referral capture, pending RSVP, tour, age gate) on actual need, code-split admin analytics / maps / charts / blog editor, and consolidate repeated Supabase access into `features/{lounge,collabs,groups,gallery,events}` service modules — centralizing column selects, visibility/blocking rules, category normalization, and query keys.

## Testing and brand protection

Per-wave tests for Lounge (public create, audio + chat entry, rejoin, end, group room, invite, expired invite), Collabs (create → apply → accept → workspace → publish → credits), Groups, Events (recurrence, RSVP, homepage), Works, and old-URL redirects. Every wave ends with an explicit brand review confirming the Workshop name, metadata, logo, and public copy are intact.

## Technical notes

- Because every legacy table is empty, Waves 0/7 need no data migration and Wave 9's rollback risk is limited to schema, not content.
- `instant_rooms` is reused as the Lounge room system; no parallel `lounge_rooms` table is created.
- Generated files (`src/routeTree.gen.ts`, `src/integrations/supabase/types.ts`) are regenerated, never hand-edited.
- Stripe/Plus, moderation, blocking, reporting, notifications, event recurrence jobs, Lounge sweep, SEO/sitemap/RSS/OG, public API routes, RLS, and contributor credits are preserved throughout.
