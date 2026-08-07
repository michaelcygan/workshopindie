# Waves 6 and 7 — One messaging policy, one notification service

Waves 1–5 are done: the inventory, the dead whiteboard removal, the service-role tightening, the atomic capacity primitives, and the transactional lifecycle transitions. Waves 6 through 14 remain. This plan covers the next two, which are the last of the "convergence" waves — after them the remaining waves are measurement, indexing, observability, security and load testing.

Nothing visible changes. Same screens, same wording, same flows.

## Wave 6 — One messaging policy layer

Today, every place a person can type a message runs its own slightly different gauntlet before saving:

- Direct messages (`dms.functions.ts`)
- Live room chat (`chat.functions.ts`)
- Group Today posts (`today-chat.functions.ts`)
- Collab workspace messages (`collab-workspace.functions.ts`)
- Collab seeded intro messages (`collab.functions.ts`)

Each one re-decides who may post, how the text is trimmed and normalized, how fast someone may post, whether the two people have blocked each other, and how the community-standards check runs. Drift between them is where quiet bugs live — a surface that forgets a block check, or rate-limits at a different threshold than its neighbour.

**What gets built:** a single pipeline, `src/lib/messaging/pipeline.server.ts`, exposing `sendMessage(surface, context, userId, body)` and running one fixed order:

```text
authorize -> normalize -> validate -> rate limit -> block check
  -> moderate -> persist (per-surface adapter) -> parse references -> notify
```

Each surface keeps its own table and its own adapter — DMs still write `messages`, live rooms still write `instant_messages`, and so on. Only the rules converge. Existing behaviour per surface is preserved exactly: where a surface intentionally differs (Today posts allow longer bodies, room chat has a tighter rate limit), that difference becomes a declared value in the surface's adapter rather than scattered logic.

Also in this wave: the moderation engine tests are currently skipped by the test script (`--exclude src/lib/moderation/engine.test.ts`). That exclusion is removed and any failures fixed, so the community-standards engine is covered on every run.

**Risk:** medium. Mitigated by per-surface tests asserting that each one still moderates, still rate-limits, and still respects blocks after the switch, plus the existing database triggers remaining untouched as the last line of defence.

## Wave 7 — One notification delivery service

Notifications are hand-written in roughly a dozen modules (`friends`, `collab`, `chat`, `today-chat`, `instant`, `lobby`, `group-events-admin`, `collab-workshop`, the sweep routes, and others). Each site re-implements some subset of: don't notify yourself, respect the recipient's preferences, skip blocked people, avoid duplicates, shape the payload.

**What gets built:** `notify()` and `notifyMany()` in `src/lib/notifications/deliver.server.ts`, owning self-suppression, preference lookup, block filtering, dedupe within a short window, and payload shape. Every hand-rolled insert site calls it instead.

The `notifications` table, the bell UI, and every existing notification kind stay exactly as they are — this is a change in who writes the row, not what the row is.

**Risk:** low-medium. Tests cover preference suppression, blocked actor, self-notify, and duplicate collapse.

## Order and checkpoints

Wave 6 first, then Wave 7 — the pipeline's final step is notification, so it should be calling the consolidated service by the time Wave 7 lands. Typecheck, lint, tests and a production build run between the two.

## Technical notes

- No new tables and no data migration in either wave.
- Adapters are thin: authorize callback, table name, insert shape, limits, notification intent.
- The moderation service (`moderateOrThrow` / `moderateFields`) remains the only text gate; the pipeline calls it, it is not reimplemented, and no per-surface word lists come back.
- Database moderation triggers on `messages`, `instant_messages`, `workshop_messages`, `group_today_posts` and friends are left untouched.
- Seeded/system messages (the Collab intro message) go through the pipeline with a system surface so they get normalization and reference parsing without a rate limit.

## What is still ahead after this

Waves 8–14: presence policy, taxonomy finish, Home fan-out measurement and reduction, indexes/pagination/counters/idempotency, error taxonomy and structured logging, security pass with a CI gate, then staged load testing and the launch report.
