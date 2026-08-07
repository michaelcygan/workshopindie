# Wave 15 — Scale Readiness Report

Status: **Stage A measured, Stage B partially applied.** This document records
what was actually measured against production, what was changed, and — most
importantly — what is still *unproven*. Nothing here is projected from theory.

## The headline

Workshop's **correctness** under concurrency is proven (Wave 13 atomic RPCs,
`src/lib/concurrency/atomic-rpcs.test.ts`). Its **capacity** is not, and cannot
be from the current production database, which holds 7 profiles, 12 works and
22 notifications. Query plans taken against a table of 12 rows tell you almost
nothing about the same query at 200k rows.

This was not a hypothetical risk during this wave — it produced a false
finding, documented below.

## Stage A — what the measurements actually showed

### The false finding (worth keeping)

The notifications feed plan showed an explicit `Sort` step:

```text
Sort  (Sort Key: notifications.created_at DESC)
  -> Bitmap Heap Scan on notifications
       -> Bitmap Index Scan on notifications_user_idx
```

The obvious reading is "the index is on `user_id` only; it needs
`(user_id, created_at DESC)`". That reading is **wrong**.
`notifications_user_idx` is *already* `(user_id, created_at DESC)`. The planner
chose a bitmap scan plus sort because the table has 22 rows, where an index
walk is not worth it. At scale the planner switches on its own.

Rule this establishes: **never conclude a missing index from a plan taken on a
near-empty table.** Confirm against `pg_indexes` before believing the plan.

### The real finding: index bloat

Planning time consistently exceeded execution time, with 330–450 shared buffers
touched *during planning alone*:

| Query shape          | Planning | Execution |
| -------------------- | -------- | --------- |
| Blog index feed      | 3.7 ms   | 0.46 ms   |
| Upcoming events feed | 3.8 ms   | 17.3 ms   |
| Works public feed    | 23.3 ms  | 6.7 ms    |

The cause: 114 indexes across the schema had **zero** scans since boot, and 20
pairs covered *exactly* the same column list. `group_events` alone carried 20
indexes. Every duplicate is dead weight on write throughput and is re-examined
by the planner on every single query.

### Other observations

- **Memory:** 62% used at idle with 15 connections and effectively no data.
  Against a 60-connection ceiling, this is the binding constraint at scale —
  not CPU.
- **Rollbacks:** ~210k rolled-back transactions since boot, consistent with RLS
  denials rather than application errors. Worth confirming, not alarming.

## Stage B — what changed

### 1. Dropped 12 exactly-redundant indexes

Each dropped index duplicated another index's column list on the same table.
In every case the retained twin is the one the planner actually uses (higher
`idx_scan`) or the UNIQUE constraint, which serves the same lookups. **No
unique constraint was dropped, so no invariant was weakened.**

Tables touched: `group_events`, `works`, `instant_presence` (the hottest write
path), `collab_posts`, `workshops`, `group_seed_links`, `event_guest_rsvps`,
`workshop_links`, `work_agreements`, `lounge_audio_events`, `group_today_pins`.

Measured effect on the upcoming-events feed:

```text
before   Planning 3.789 ms   Execution 17.283 ms
after    Planning 1.947 ms   Execution  1.309 ms
```

Planning time roughly halved. The execution improvement is partly cache warmth
and should not be read as a 13x win.

### 2. Edge caching on anonymous homepage payloads

`getPublicHome` and `listHomeWorkStories` now send
`public, s-maxage=60, stale-while-revalidate=600`, matching the existing
`PUBLIC_CACHE` convention in `src/lib/seo-loaders.functions.ts`. A burst of
cold anonymous traffic now collapses into one origin hit per minute.

**Deliberately not cached:**

- `getMemberHome` — scoped to `context.userId`.
- `geo.functions.ts` (`inferCityFromIp`, `getDefaultHomeCity`) — these vary by
  client IP and `authorization` header. A shared cache here would serve one
  visitor's inferred city to another. This is a correctness trap, not an
  oversight.
- `auth-email.functions.ts` — account-existence checks must never be cached.

## Still unproven — do not claim these are done

1. **No load test has been run.** `scripts/scale/load-profile.js` (k6) is
   written but needs a seeded scratch project and a `BASE`/`TOKEN`. Until it
   runs, there is no p95 number for any endpoint.
2. **No large-corpus plans exist.** `scripts/scale/seed-corpus.sql` generates
   50k profiles / 500k notifications; `scripts/scale/explain-shapes.sql`
   re-runs the eight hot shapes against it. Run both in a **scratch** project
   and diff against the Stage A table above. Real index gaps will only become
   visible here.
3. **~100 unused indexes remain.** Only exact duplicates were dropped, which is
   the unambiguously safe subset. The rest have zero scans but may serve rare
   admin paths or upcoming features; dropping them needs case-by-case review.
4. **Compute has not been resized.** The 62%-at-idle memory reading argues for
   it, but resizing before a load test means guessing at the size. Load test
   first, then size to the evidence.

## Open product decision

`reserve_event_rsvp` counts RSVP *rows*, not `plus_ones`. A capacity-10 event
can therefore seat more than 10 people if guests bring companions. This is
current documented behaviour, not a bug — but if capacity is meant to mean
heads, the reservation routine needs to sum `1 + plus_ones` against capacity.

## Runbook pointers

- Slow-query triage: `supabase--slow_queries`, then
  `EXPLAIN (ANALYZE, BUFFERS)` on the offender.
- Index inventory: `pg_stat_user_indexes` (`idx_scan = 0` = candidate).
- Duplicate detection: group `pg_index` by `(indrelid, indkey, indpred IS NOT NULL)`
  and look for `count(*) > 1`.
- Before dropping any index, confirm it is not backing a UNIQUE constraint.

---

# Stage C — realtime, presence, rollbacks, first measured run (2026-08-07)

## Realtime fan-out: fixed

Every signed-in session used to open four always-on channels; two of them
subscribed to `messages`/`conversations` with **no server-side filter**, so the
realtime server evaluated every message insert in the app against every
connected session — O(sessions x messages).

All four collapsed into one per-session channel,
`notifications:<uid>` (`src/hooks/use-realtime-notifications.tsx`), filtered
`user_id=eq.<uid>`. The DM badge now rides the existing `dm` notification kind,
which is already written per recipient. Net: 4 channels -> 1, and the app-wide
`messages` fan-out is gone.

## Presence write load

`PresenceHeartbeat` beats once per 60s, pauses on hidden tabs, and calls a
single `touch_presence` RPC that writes the ephemeral `user_presence` row and
only refreshes the durable `profiles.last_active_at` every 10 minutes. At 10k
concurrent visible tabs that is ~167 RPC/s, dominated by cheap upserts.

Added in this stage: a random 0-15s offset before the first beat, so sessions
that start in the same second stop beating in lockstep. Interval, online
window, and policy constants unchanged.

## Rolled-back transactions: benign, historical

`pg_stat_database` showed 211,012 rollbacks. Sampled over 60 seconds:

```text
21:02:31  commits 7,589,170  rollbacks 211,012
21:02:52  commits 7,589,175  rollbacks 211,012
21:03:13  commits 7,589,223  rollbacks 211,012
```

Rollbacks are **flat** while commits advance. The counter is cumulative since
the stats reset on 2026-05-07 (92 days) and reflects a historical burst, not an
ongoing rate — 2.7% of all transactions, none of it recent. No deadlocks, no
conflicts. Treat the raw number as noise; alert on the *rate*, not the total.

## First measured load run

The full profile (400 VU ramp) could not run against a hosted target: the
preview deployment returns 403 to unauthenticated load traffic, and production
is off-limits. A `SMOKE=1` mode was added to the same script and run against
the local dev server, which shares the real database.

```text
SMOKE=1 BASE_URL=http://localhost:8080 k6 run scripts/scale/load-profile.js

http_req_failed   0.00%  (0 of 310)
t_anon_browse     med 50ms   p95 590ms   max 970ms
t_event_read      med 45ms   p95 54ms    max 157ms
```

Zero failures. The anon-browse tail is dev-server SSR cost (unminified, no
edge cache), not database time — the events read, which touches the same
database through a narrower render, sits at p95 54ms. This validates the
harness and the query paths; it does **not** establish a production p95. That
still needs the full profile against a scratch project seeded with
`seed-corpus.sql`.

## Still open

- Full 400-VU profile against a seeded scratch project.
- Signed-in realtime verification (one channel per session, live DM badge) —
  see the manual check in `docs/ops-runbook.md`.
- Compute sizing decision, deferred to the full load run.
- ~100 zero-scan indexes awaiting case-by-case review.
