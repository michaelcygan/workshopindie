# Workshop — Backend Consolidation, Reliability & Scale Pass

Product, design, navigation and UX stay frozen. Every change below is under the surface: same screens, same flows, stronger machinery. Work ships wave by wave, with typecheck, lint, tests and a production build between waves.

## What the audit already found

Verified against the live codebase and database:

- **Dead whiteboard code with a privileged hole.** `purgeRoomWhiteboard` in `src/lib/room-views.functions.ts` takes any room id from any signed-in user and deletes `instant_board_items` rows with service-role access — no membership check. The whiteboard feature is gone from the product; only `channel-view.tsx` still calls it, plus a copy-forward step in `collab-workshop.functions.ts`. The table holds 1 row.
- **Room admission is not atomic.** `joinSpecificInstantRoom` reads `instant_rooms`, counts recent `instant_presence` rows, then returns "you may enter". Two simultaneous joins can both pass the cap check.
- **Workshop seats are not atomic.** Lobby/workshop participation inserts into `workshop_participants` after reading state; `participant_cap` is never enforced in a single transaction.
- **Event capacity is not enforced in the write path.** `group_events` has `capacity`, `going_count`, `waitlist_count` maintained by a counter trigger, but nothing rejects the over-cap RSVP inside the same transaction.
- **DMs are half-protected.** `conversations` already has `conversations_pair_unique` and a `user_a < user_b` check — good. But `openOrCreateConversation` does select-then-insert, so a simultaneous open from both sides surfaces a raw unique-violation error instead of returning the existing thread.
- **Service-role sprawl.** ~50 modules import the admin client, including ordinary reads. This is the boundary that needs to become small and obvious.
- **Notifications are written by hand in ~13 modules** with per-site preference/blocking logic.
- **Presence writes to `profiles`.** `presence-heartbeat.tsx` + `friends.functions.ts` touch `profiles.last_active_at`; that write scales with open tabs.
- **Moderation tests are excluded from `bun test`** by the `--exclude src/lib/moderation/engine.test.ts` flag in `package.json`.

## Waves

### Wave 1 — Architecture inventory (no code changes)
Produce `docs/architecture-inventory.md`: tables, RPCs, triggers, cron jobs, server functions, realtime channels, service-role call sites, notification producers, messaging surfaces, taxonomy fields — each classified ACTIVE / CANONICAL / COMPATIBILITY / MIGRATE / DELETE with verified reference counts. Nothing is deleted on suspicion alone.
Risk: none.

### Wave 2 — Remove dead whiteboard infrastructure
Delete `purgeRoomWhiteboard` and its `channel-view.tsx` call site, drop the board copy-forward step in the collab→workshop promotion, then retire `instant_board_items` (archive the single row first) in a separate migration once code no longer references it.
Risk: low. Rollback: table drop is the last, separately revertable step.

### Wave 3 — Harden the service-role boundary
Convert admin-client reads that RLS already covers to user-scoped clients. What genuinely needs privilege moves behind a small set of named helpers in `src/lib/admin/` (`adminCreateSystemNotification`, `adminPerformModerationAction`, `adminRunLifecycleTransition`, `adminSweepJob`). Add an ESLint rule so `client.server` can only be imported from `src/lib/admin/`, moderation, and cron routes.
Risk: medium — a missed RLS gap turns into a runtime denial. Each converted call site gets an explicit read test.

### Wave 4 — Atomic capacity and get-or-create
New Postgres functions, each returning a deterministic status (`joined | already_joined | full | closed | forbidden`):
- `reserve_workshop_seat(workshop_id, user_id)` — locks the workshop row, counts confirmed participants, inserts or returns existing.
- `reserve_event_rsvp(event_id, user_id, status)` — same shape; overflow becomes `waitlist` when waitlist is enabled, else `full`.
- `join_instant_room(room_id, user_id)` — eligibility, lock, removal cooldown, cap against live presence, upsert presence.
- `get_or_create_conversation(a, b, context…)` — normalized pair + `ON CONFLICT DO NOTHING … RETURNING`, always returns the canonical id.
- Unique constraint making one live room per workshop impossible to duplicate.
Server functions become thin callers. Risk: medium; covered by concurrency tests that fire N simultaneous requests at one seat.

### Wave 5 — Lifecycle transitions become single transactions
`open_workshop_for_collab(...)` and `promote_room_to_collab(...)` do the linked writes (create, backlink both ways, host membership, source refs, mark promoted) in one transaction. Asset copying and notifications stay outside it, after success. Both are idempotent on re-execution.
Risk: medium-high — the most intricate flows in the app. Each gets a regression test asserting the full object graph, plus a duplicate-execution test.

### Wave 6 — One messaging policy layer
`src/lib/messaging/pipeline.server.ts` exposes `sendMessage(surface, context, userId, body)` running: authorize → normalize → validate → rate limit → block check → moderate → persist via adapter → parse mentions → notify. DM, Lounge, Today and Collab keep their own tables and adapters; only the rules converge. Also drop the moderation exclusion from the `test` script.
Risk: medium. Existing per-surface behavior is preserved adapter-side; tests assert each surface still moderates, rate-limits and respects blocks.

### Wave 7 — One notification delivery service
`notify()` / `notifyMany()` in `src/lib/notifications/deliver.server.ts` owns preferences, block filtering, self-suppression, dedupe and payload shape. The ~13 hand-rolled insert sites call it instead. Table, UI and existing kinds unchanged.
Risk: low-medium. Test: preference suppression, blocked actor, self-notify.

### Wave 8 — One presence policy
Document and enforce two tiers: ephemeral realtime/`instant_presence` for "online now" and in-room state; durable `profiles.last_active_at` written only on session boundaries and a throttled interval (measured, not guessed). Green dots read the ephemeral tier.
Risk: low. Rollback: revert the heartbeat interval.

### Wave 9 — Finish the taxonomy migration
`taxonomy.ts` stays canonical. Inventory remaining stored representations (legacy category enums, singular/plural fields, group category, blog compatibility), define the final stored form, migrate data, keep compatibility reads, and drop legacy columns only in a later migration once nothing reads them.
Risk: medium — staged so no single migration rewrites data and changes behavior at once.

### Wave 10 — Measure and reduce Home fan-out
Instrument `src/lib/home.server.ts` (1,846 lines, ~56 query sites): calls per request, total DB time, p50/p95/p99, slowest queries, duplicated lookups. Then reduce with targeted read models, combined queries and cached public rails — no Home redesign, and per-rail failure still degrades gracefully.

### Wave 11 — Indexes, pagination, counters, idempotency
Index work driven by real plans (`EXPLAIN`, index_advisor) on messages, instant_messages, instant_presence, notifications, follows, group memberships, comments, reactions, RSVPs, participants. Keyset pagination for high-growth lists (implementation only, unchanged UX). Each denormalized counter labelled authoritative/derived/trigger-maintained with one canonical update path. Retry-safe writes for RSVP, follow, group join, conversation open, room creation, invite acceptance, webhooks.

### Wave 12 — Error taxonomy and observability
Canonical domain errors (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `ALREADY_EXISTS`, `FULL`, `CLOSED`, `RATE_LIMITED`, `MODERATION_BLOCKED`, `INVALID_INPUT`, `CONFLICT`) mapped to today's UI strings — no visible change. Structured logging (operation, entity, duration, result code) around messaging, RSVP, room join, auth, webhooks and Home. No message bodies logged.

### Wave 13 — Security pass and CI
Targeted review of RLS coverage, storage policies, admin/cron endpoints, draft and soft-deleted content, and every endpoint where the caller supplies an id the server then acts on with privilege. CI gate: typecheck, lint, unit tests including moderation, production build, plus a backend regression suite covering the invariants above.

### Wave 14 — Staged load testing and launch report
Stages A–E (100 → 5,000 concurrent) with a realistic behavior mix, plus burst tests (event RSVP spike, final-seat contention, mass lounge entry, DM burst, notification fan-out). Record p50/p95/p99, error rate, DB CPU and connections, realtime counts, slow queries. Final report: what was consolidated, what was removed, concurrency bugs fixed, invariants added, performance and security changes, what was deliberately left alone, load results, remaining limits, and recommended configuration for launch / 10k DAU / 100k DAU.

## Deliberately not doing

No Redis, no microservices, no queue infrastructure, no database split, no generic platform abstractions. Message tables stay separate — only their rules converge. No UI, navigation or product changes.
