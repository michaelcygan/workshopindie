# Workshop — operations runbook

The page to open when something is wrong and it is 3am. Read top to bottom the
first time; after that, jump to the symptom.

Companion documents: `docs/scale-report.md` (what was measured and why),
`docs/indexes-and-pagination.md` (read-path shapes), `docs/home-fanout.md`
(the heaviest query in the app).

---

## 1. Health check — the six numbers

Run the backend health snapshot. Six numbers matter, in this order.

| Signal | Healthy | Watch | Act |
| --- | --- | --- | --- |
| Database status | up | — | not up: restart the backend, then re-check |
| Connections | < 50% of max | 50-80% | > 80% sustained: see §4 *Database saturated* |
| Pooler (PgBouncer) clients | < 50% | 50-80% | > 80%: connection leak or traffic spike |
| Memory | < 70% | 70-85% | > 85% sustained, or any OOM kill: resize compute |
| Data disk | < 70% | 70-85% | > 85%: increase **disk size**, not compute |
| Restarts since last check | 0 | 1 | 2+ in an hour: crash loop — check OOM kills first |

Baseline at rest (2026-08-07): connections 12/60, pool 1/200, memory 63%,
disk 30%, 0 restarts.

**Compute and disk are separate controls.** A full disk is not fixed by a
bigger instance, and a memory ceiling is not fixed by more disk. Match the
change to the saturated metric.

---

## 2. Known-benign signals — do not chase these

- **Cumulative rolled-back transactions.** The counter is a running total since
  the last stats reset, not a rate. Workshop currently shows ~211k rollbacks
  against 7.6M commits accumulated over three months, and sampling shows the
  number is flat while commits advance. Only a *rising* count over a short
  window means anything.
- **A handful of deadlocks.** Single digits across weeks is normal contention.
  Growth between two checks minutes apart is not.
- **Temp files.** Steady low-rate growth is ordinary sort/hash spill.
- **WAL size fluctuating.** It grows and is recycled. Sustained one-way growth
  with no checkpointing is the problem, not the size itself.

### How to turn a counter into a rate

```sql
select now(), xact_commit, xact_rollback, deadlocks
from pg_stat_database where datname = 'postgres';
```

Run it twice, 60 seconds apart, and subtract. Judge the delta, never the total.

---

## 3. Alert thresholds

| Metric | Page someone |
| --- | --- |
| Memory | > 85% for 10 minutes, or any OOM kill |
| Connections | > 80% of max for 5 minutes |
| Data disk | > 85% |
| Rollback rate | > 5% of transactions over a 5-minute window |
| Deadlocks | any increase of 10+ in an hour |
| HTTP 5xx | > 1% of requests over 5 minutes |
| p95 page latency | anon > 800ms, member home > 1500ms, event read > 1000ms |

The latency numbers are the thresholds encoded in
`scripts/scale/load-profile.js`. They are the launch bar; if the load profile
fails them, the instance size or a query plan is the problem, not the test.

---

## 4. Triage trees

### The app feels slow

1. Is it the frontend or the backend? Open the network panel. Slow *document*
   or slow API responses -> backend. Fast responses, slow paint -> frontend
   (bundle size, blocking JS). A bigger instance fixes nothing in the second case.
2. Backend: pull the slow-query list, ranked by total execution time.
3. Take the top offender and run `EXPLAIN (ANALYZE, BUFFERS)` on it. Look for
   sequential scans on large tables and row-estimate errors of 10x or more.
4. Missing index -> add a targeted one in a migration (plain `CREATE INDEX`;
   `CONCURRENTLY` cannot run inside a migration transaction). Re-run `EXPLAIN`
   to confirm it is used.
5. Only after the plans are clean, and only if §1 shows memory or connection
   pressure, consider a compute resize.

### The database is saturated

1. Check connections and pooler saturation.
2. Look for long-running or idle-in-transaction sessions:

   ```sql
   select pid, state, wait_event_type, wait_event,
          now() - xact_start as xact_age, left(query, 120) as query
   from pg_stat_activity
   where state <> 'idle'
   order by xact_start nulls last
   limit 20;
   ```
3. `idle in transaction` sessions holding locks are the usual culprit — that
   is a code path that opened a transaction and did not close it.
4. If activity is genuinely healthy and the connections are all doing real
   work, this is a capacity problem: resize compute.

### Realtime feels dead (badges/messages not updating)

1. Each signed-in session should hold **exactly one** realtime channel:
   `notifications:<user-id>:<nonce>`, filtered `user_id=eq.<uid>`. More than
   one means a component regressed and opened its own subscription.
2. The single subscription lives in
   `src/hooks/use-realtime-notifications.tsx`. Every consumer (bell, DM badge,
   tab-title badge, DM inbox) reads from that hub — never from its own channel.
3. Never subscribe to `messages` or `conversations` without a server-side
   filter. Neither table can express "rows for me" as an equality filter, so an
   unfiltered subscription makes the realtime server evaluate every insert in
   the app against every connected session. Route new per-user signals through
   a `notifications` row instead.
4. If badges are stale but the channel is open, the notification row is
   probably not being written — check the trigger or service that emits it.

### Auth is failing

1. Distinguish sign-*in* from sign-*up*; they fail for different reasons.
2. `Unsupported provider` -> the social provider is switched off in the
   backend auth config. Enable it.
3. OAuth returning to a blank page or bouncing to sign-in -> the `redirect_uri`
   points at a protected route. It must be a public same-origin URL
   (`window.location.origin` or `/auth/callback`), with the intended
   destination stored separately and navigated to after the session hydrates.
4. Email sign-up hanging -> check for a failing trigger on user creation
   (`handle_new_user` and friends). A trigger error surfaces as a hung or
   500-ing signup, not as an auth error.

### A user reports "I created it but it doesn't show up"

Almost always a visibility state (draft, private, unlisted, pending) plus a
missing owner-side read path: the public policy filters the row out for its own
author. Check that an owner-scoped SELECT policy exists and that the surface
the user landed on queries the owner fetcher, not the public one.

---

## 5. Manual pre-launch checks

These need a real signed-in session and could not be automated here.

**Realtime channel count.** Sign in, open the app, and in the browser console
inspect the active realtime channels. Expect exactly one, named
`notifications:<your-user-id>:<nonce>`. Navigate across home, a group, and the
DM inbox — the count must stay at one.

**DM badge.** With that session open, have a second account send a DM. The
envelope badge and the tab-title badge should both increment without a reload.
Open the thread; both should clear.

**Presence.** Two sessions, both visible, should show each other as online
within a minute, and drop off after the online window once both are closed.

---

## 6. Load testing

```bash
# 45-second sanity run — safe against any target
SMOKE=1 BASE_URL=http://localhost:8080 k6 run scripts/scale/load-profile.js

# Full profile — scratch project only, never production
BASE_URL=https://<scratch>-dev.lovable.app \
SUPABASE_ACCESS_TOKEN=<a real user token> \
k6 run scripts/scale/load-profile.js
```

The full profile ramps to 400 anonymous VUs plus signed-in home and RSVP-burst
scenarios, and takes about 12 minutes. Seed the target with
`scripts/scale/seed-corpus.sql` first, or the numbers describe an empty
database and mean nothing. The hosted preview deployment returns 403 to
unauthenticated load traffic, so point the full run at a scratch project.

---

## 7. When to resize compute

Resize when, and only when:

- memory is above 85% under real load, or there has been an OOM kill; or
- connection/pooler saturation is above 80% with `pg_stat_activity` showing
  legitimate concurrent work rather than stuck transactions; and
- the slow-query list has already been triaged, so you are not buying your way
  out of a missing index.

Do not resize for frontend slowness, for disk pressure, or on the strength of
an idle-state memory reading. Resizing takes a few minutes and changes Cloud
usage. In the product: project -> Backend -> Advanced settings -> Upgrade
instance. If that control is unavailable, the workspace plan may need to change.
