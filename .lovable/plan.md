# Wave 15 — Scale Readiness

## Straight answer

The backend polish is complete. Scale readiness is **not proven**, and today the honest
answer to "ready for 10k–100k DAU?" is no — not because something is broken, but because
nothing has ever been measured under load.

What Waves 1–14 delivered is *correctness under concurrency*: atomic RPCs that can't
oversell an event, RLS that fails closed, moderation that can't be bypassed, a security
surface with no open findings. That work holds at any scale.

What has not been established is *capacity*. The production database currently holds
7 profiles, 12 works, and 22 notifications. Every timing in the launch report was measured
against an effectively empty dataset. A query that takes 5ms across 12 blog rows tells us
nothing about the same query across 50,000.

## What the current numbers actually say

| Signal | Reading | Meaning |
| --- | --- | --- |
| Memory | 62% used at idle | Near-empty database, 15 connections, and the instance is already two-thirds committed |
| Connections | 15 / 60 | The ceiling is 60. Serverless request fan-out can exhaust that fast |
| Data disk | 30% of a small disk | Fine now; grows with uploads and event occurrences |
| Rolled-back transactions | ~210k since May | Mostly expected RLS denials, but the rate deserves a look before it is dismissed |

The single loudest historical signal — 8,972 direct `profiles.last_active_at` updates
averaging 14ms and peaking at 1.9s — is the *old* per-tab heartbeat, from before Wave 8
split presence into two tiers. Current code writes only to the ephemeral `user_presence`
table and touches `profiles` at most once per 10 minutes. That fix is already in, and the
counters are cumulative since the last database boot in May, so they are history, not a
live problem. It is a good illustration of the failure mode to watch for: a hot write onto
a table the whole app reads.

## The five things that decide whether Workshop survives 10k–100k DAU

**1. Compute sizing.** At 62% memory with almost no traffic, the current instance will not
absorb launch load. This is a resize, not a code change — but it needs to happen before
traffic, not during it.

**2. Anonymous page reads.** Blog feeds, sitemap, RSS, OG images and the news ticker already
send `s-maxage`. The highest-traffic public surfaces — the logged-out home page, `/$username`,
`/g/$slug`, `/events` — do not. Every anonymous visitor, including every crawler and every
social-preview fetch, currently reaches Postgres. At 100k DAU that is the first thing to fall
over, and it is also the cheapest thing to fix: these pages tolerate a 60-second cache.

**3. Presence and realtime fan-out.** Every signed-in tab heartbeats once a minute, and more
than twenty components hold `postgres_changes` subscriptions. At 10k concurrent tabs that is
~167 presence writes/second plus tens of thousands of live subscriptions. The write path is
now cheap; the subscription count is the unmeasured axis.

**4. Query behaviour at real row counts.** Indexes exist for the current query shapes, but
planner choices change once tables are 1000x larger. This needs a seeded copy of the database,
not reasoning.

**5. Rate limiting at the edge.** `check_and_bump` guards individual write paths well. There is
no protection in front of the expensive *read* paths, so a scraper can be more costly than a
user.

## Proposed work

### Stage A — Measure before changing anything
- Build a seeding script that produces a realistic corpus (50k profiles, 200k works, 500k
  notifications, 100k event occurrences) in a scratch project.
- Re-run the slowest known query shapes against that corpus with `EXPLAIN (ANALYZE, BUFFERS)`
  and record which plans degrade.
- Run a k6 load profile against preview: anonymous browse, signed-in home, event RSVP burst,
  DM send. Capture p50/p95/p99 and the connection high-water mark.
- Write the findings to `docs/scale-report.md`. Nothing in Stage B is worth doing before this
  document exists, because it decides the ordering.

### Stage B — Fix what the measurements name
Expected, subject to Stage A:
- Cache headers plus a short SSR cache on the four public high-traffic routes.
- Indexes or query reshaping for whichever plans degraded.
- Audit the realtime subscriptions: consolidate per-component channels, and drop
  subscriptions on surfaces where a 30-second refetch is indistinguishable to the user.
- Rate limiting on public read endpoints and OG generation.
- Pagination caps on any endpoint currently able to return an unbounded set.

### Stage C — Capacity and operations
- Resize Lovable Cloud compute based on the Stage A high-water mark, then re-run the load
  profile against the new size to confirm the headroom is real.
- Add a synthetic uptime check on the four public routes plus one signed-in path.
- Define alert thresholds: memory, connection saturation, p95 latency, error rate.
- Write the runbook: what to do when connections saturate, when the news ticker upstream
  fails, when the moderation queue backs up.

## Technical notes

- Load generation runs against the preview deployment, never production.
- Seeding runs in a scratch Supabase project so production row counts stay honest.
- The existing concurrency suite (`src/lib/concurrency/atomic-rpcs.test.ts`) already proves
  correctness under contention; Stage A measures throughput, which is a separate question.
- Compute resize is an infrastructure action requiring approval, and takes a few minutes.

## Scope note

Stage A is the honest deliverable — it converts "we think it scales" into a number.
Stages B and C follow from it. If the goal is a soft launch at hundreds of DAU rather than
tens of thousands, the compute resize plus the public-route caching in Stage B are sufficient
on their own, and the rest can wait for real traffic.
