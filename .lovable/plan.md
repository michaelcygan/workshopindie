# Waves 10 and 11 — measure Home, then fix the read path

## Where Wave 9 stands

Wave 9 is done through step 4, which is as far as it was meant to go:

- The inventory is written down in `docs/taxonomy-inventory.md`, verified against live rows.
- Canonical category columns exist alongside the legacy enum columns, backfilled and kept in sync by trigger.
- Reads and filters moved to the canonical values.

Step 5 — dropping the legacy `category` columns and enum — was deliberately deferred. It is destructive and only safe once nothing references those columns, so it stays parked until the security/CI wave, when a reference sweep can gate it. Nothing else in Wave 9 is outstanding.

## Wave 10 — Measure the Home fan-out, then reduce it

`src/lib/home.server.ts` is 1,846 lines with roughly 56 query sites. Everyone assumes it is the hot path; nobody has numbers.

**Step 1 — instrument before touching anything.** A small timing wrapper records, per Home request: number of queries, total database time, per-rail duration, and repeated identical lookups. Results are logged structurally and summarised into `docs/home-fanout.md` (p50/p95/p99, slowest rails, duplicate queries).

**Step 2 — reduce only what the numbers justify.** Expected shapes of the fix, in preference order:
- de-duplicate lookups that several rails each perform (profiles, groups, city rows) by resolving them once per request;
- collapse per-row follow-up queries into a single batched fetch where an N+1 pattern shows up;
- fold the fully public rails behind a short-lived cached read so signed-out and cold traffic does not re-derive them per request.

**Step 3 — keep the failure behaviour.** Each rail still degrades on its own today; that stays. Home renders with a rail missing rather than erroring.

No Home redesign, no changed rails, no changed ordering. If the measurement says a rail is already cheap, it is left alone and the report says so.

## Wave 11 — Indexes, pagination, counters, idempotency

Four related pieces of read-path and write-path hygiene.

**Indexes from real plans.** Run `EXPLAIN` and the index advisor against the queries the app actually issues on `messages`, `instant_messages`, `instant_presence`, `notifications`, `follows`, `group_members`, `comments`, reactions, RSVPs and participants. Add only indexes a plan asks for; record each one and the query that justified it.

**Keyset pagination for high-growth lists.** DM threads, room chat, notifications, group feeds and event RSVP lists move from offset to cursor pagination underneath. Page size, controls and visual behaviour are unchanged — this is implementation only.

**One update path per counter.** Every denormalised count (member counts, RSVP counts, reaction counts, unread counts) gets labelled authoritative, derived, or trigger-maintained, with exactly one place that writes it. Where two paths currently write the same counter, one wins and the other calls it.

**Retry-safe writes.** RSVP, follow, group join, conversation open, room creation, invite acceptance and webhook handling become idempotent on re-execution — a double-tap or a retried request returns the existing result instead of creating a second row.

## Risk and verification

Wave 10 is low risk: measurement first, then narrowly scoped query changes behind unchanged rail contracts. Wave 11 is medium — pagination and counters touch live lists, so each gets a regression test plus a check against real rows before moving on. Migrations in Wave 11 are additive (indexes, unique constraints); nothing is dropped.

After each wave: typecheck, unit tests including moderation, production build, and a manual pass over Home, a DM thread, a room, and an event RSVP.

## Still ahead

Wave 12 (error taxonomy and structured logging), Wave 13 (security review and CI gate, plus the deferred legacy-column drop), Wave 14 (staged load testing and the launch report).
