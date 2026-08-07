# Wave 15 — Stage C, remaining work

The realtime consolidation shipped: one channel per signed-in session instead of four, with the DM badge riding the `dm` notification kind. What's left is the operational half of Stage C — measuring the remaining write load, explaining the rollback counter, running the load profile, and writing the runbook the future you will actually need at 3am.

## What I verified just now

- Database is healthy: up, 0 restarts, connections 12/60, pool 1/200, disk 30%, memory 63%.
- Rollback counter is 211,012 against 7,588,615 commits since the stats were last reset on 2026-05-07 — roughly 2.7% of transactions, cumulative over three months, not a live rate.
- Presence is already two-tier: `PresenceHeartbeat` beats once per 60s, pauses on hidden tabs, and calls a single `touch_presence` RPC that only refreshes the durable `profiles.last_active_at` every 10 minutes.

## Plan

### 1. Presence write load — reduce the thundering herd
Heartbeats are cheap per call, but every session started in the same minute beats in the same second. Add a small random offset (0–15s) to the first beat so writes spread across the interval instead of spiking. No change to the interval, the policy constants, or the online window.

### 2. Rollback triage
Snapshot `xact_rollback` now, then again after a short interval, to convert the cumulative counter into a rate. Check `pg_stat_database` conflicts/deadlocks and the Postgres logs for the dominant error class. Expectation to confirm or disprove: most rollbacks are ordinary PostgREST request failures (RLS denials, unique-constraint hits on idempotent inserts), which are benign. Record the finding — no fix unless the rate is meaningful.

### 3. Run the load profile
Execute the prepared k6 script (`scripts/scale/load-profile.js`) against the seeded corpus and capture p50/p95 latency for the hot read shapes (home, events feed, group page, profile). Compare against the Stage A baseline already in `docs/scale-report.md` and append a Stage C section with the results.

### 4. Ops runbook — `docs/ops-runbook.md`
A single page covering:
- Health check: which numbers to read from the database snapshot and what "bad" looks like for each.
- Alert thresholds: memory, connection saturation, disk, rollback rate, WAL growth.
- Triage trees: app is slow, database is saturated, realtime feels dead, auth failing.
- When to resize compute vs. when to fix a query, and the fact that compute and disk are separate controls.
- Known-benign signals so nobody chases them (cumulative rollbacks, small deadlock counts).

### 5. Signed-in realtime verification
The one-channel-per-session count and a live DM badge fire still haven't been observed with a real session — the browser tool had no signed-in session available. I'll re-attempt once a session is injected; if it still isn't, the runbook will carry it as a manual pre-launch check with exact steps.

## Not in this plan

- `reserve_event_rsvp` still counts RSVP rows rather than heads including `plus_ones`, so a capacity-10 event can seat more than 10 people. Separate decision, separate change — say the word and I'll fix capacity to mean people.
- No compute resize proposed: memory at 63% idle on a near-empty dataset is worth watching, but the load-test results in step 3 should decide it rather than a guess.

## Technical notes

- Presence jitter lands in `src/components/presence-heartbeat.tsx` only; `src/lib/presence/policy.ts` constants and their tests stay untouched.
- Rollback triage and load measurement are read-only; no migrations.
- Documentation changes are confined to `docs/scale-report.md` (append) and the new `docs/ops-runbook.md`.
