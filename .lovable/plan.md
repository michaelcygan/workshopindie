# Wave 15 — Stage C: Realtime Fan-Out, Ops, and Capacity

Stage A measured the database. Stage B removed duplicate indexes and added edge
caching. Stage C addresses the part that actually decides whether Workshop
survives 10k concurrent users — and it is **not** the database.

## The headline finding

Every signed-in session currently opens **four** always-on realtime channels
from the header and root layout. Two of them are exact duplicates of the other
two, and two of them have **no filter at all**.

Verified in source:

| Where | Channel | Subscribes to | Filter |
| --- | --- | --- | --- |
| `notifications-bell.tsx` | `notifs:<uid>` | `notifications` INSERT | `user_id=eq.<uid>` |
| `use-title-badge.ts` | `title-notifs:<uid>` | `notifications` `*` | `user_id=eq.<uid>` |
| `messages-inbox-button.tsx` | `dm-inbox:<uid>` | `messages` INSERT/UPDATE, `conversations` INSERT | **none** |
| `use-title-badge.ts` | `title-dm:<uid>` | `messages` INSERT/UPDATE, `conversations` INSERT | **none** |

The unfiltered `messages` subscriptions are the problem. With no filter, the
realtime server evaluates **every message insert in the entire app against
every connected session**. Row-level security stops users from *reading* other
people's messages, but it does not stop the fan-out work from happening.

```text
cost of one DM being sent
  today:  2 unfiltered channels x N connected sessions
  at 10k concurrent: ~20,000 channel evaluations per message
```

This scales as O(users x messages) — the one shape that genuinely falls over.
It is invisible today because there are 7 profiles.

## What Stage C does

### 1. Collapse four channels into one (the priority)

`messages` has no recipient column (only `conversation_id` and `sender_id`),
and `conversations` splits the pair across `user_a`/`user_b`, so a
`postgres_changes` equality filter cannot express "messages for me". The fix is
to stop listening to `messages` from global UI entirely.

A `dm` notification kind already exists and already has rows. The DM badge can
ride the existing per-user, already-filtered `notifications` channel:

- One shared `notifications:<uid>` channel, subscribed once at the root.
- The bell and the DM inbox badge both read from it, distinguishing by `kind`.
- `use-title-badge` consumes the same shared source instead of opening its own.
- The open-thread view (`dms.$conversationId`) keeps its own subscription —
  that one is correctly scoped to a single conversation.

Result: 4 always-on channels per session becomes 1, and the unfiltered
app-wide `messages` fan-out disappears.

### 2. Presence write load

`presence-heartbeat` writes every 60s from every session. At 10k concurrent
that is ~167 writes/sec sustained to `instant_presence`. Measure the actual
cost, then decide between a longer interval when the tab is backgrounded and
batching. No change until it is measured.

### 3. Investigate the 211k rolled-back transactions

Cumulative since boot, on a database with almost no data. The working
assumption is RLS denials, but that is unverified. If it is something else —
a retry loop, a failing trigger — it will scale linearly with traffic. Find
the source before sizing anything.

### 4. Run the load test that Stage A only prepared

`scripts/scale/seed-corpus.sql` and `scripts/scale/load-profile.js` exist but
have never been executed. Seed a **scratch** project, re-run
`scripts/scale/explain-shapes.sql`, and diff against the Stage A baselines in
`docs/scale-report.md`. Real index gaps only become visible at size — the
Stage A notifications false positive is the proof.

### 5. Ops runbook and alert thresholds

Write `docs/ops-runbook.md`: what to check when the app is slow, how to read
the health snapshot, how to triage a slow query, and the index rules from
Stage B (never drop an index backing a UNIQUE constraint; confirm against
`pg_indexes` before believing a plan).

Thresholds to alert on, based on current readings (62% memory, 10/60
connections, 30% disk, 197MB database):

- memory above 85%
- connections above 40/60
- data disk above 70%
- any OOM kill or unplanned restart
- rolled-back transactions growing faster than traffic

### 6. Compute sizing — deliberately last

Memory sits at 62% at idle with effectively no data, which does argue for a
larger instance. But resizing before the load test means buying a size chosen
by guesswork, and the realtime fan-out above is a bigger threat than raw
compute. Size to evidence, after steps 1 and 4.

## Technical notes

- The channel consolidation is frontend-only: a shared subscription (context or
  a single hook at the root) plus `kind`-based routing. No schema change, no
  new table, no migration.
- `dm` notification rows already exist, so the badge has a source. Confirm
  coverage of every path that should light the badge — including message
  *updates* such as read receipts, which the current unfiltered subscription
  picks up incidentally.
- The corpus seeder must run against a scratch project, never production.
- Nothing in this stage weakens RLS. The fan-out fix reduces work the realtime
  server does before RLS is applied; it does not change who can read what.

## Out of scope

- Dropping the ~100 remaining zero-scan indexes. Only exact duplicates were
  safe to remove in bulk; the rest need case-by-case review.
- `reserve_event_rsvp` counting rows rather than `1 + plus_ones`. Still an open
  product decision, not a scale issue.
