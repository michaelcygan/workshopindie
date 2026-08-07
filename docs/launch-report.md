# Workshop — Launch Readiness Report

Status of the backend consolidation, reliability, and scale programme (Waves 1–14).
This is the reference for how the system is expected to behave under load and
what is deliberately left for later.

## 1. Architecture at a glance

| Layer | Where it lives | Rule |
| --- | --- | --- |
| Routing / pages | `src/routes/**` | TanStack Start file routes. `/username` is the canonical creator URL; `/u/$username` 301s to it. |
| App-internal RPC | `src/lib/**/*.functions.ts` | `createServerFn`. Thin wrappers only — no runtime helpers at module scope. |
| Server-only logic | `src/lib/**/*.server.ts` | Never imported from a route or component; reachable only through a `.functions.ts`. |
| External HTTP | `src/routes/api/public/**` | Bypasses site auth by design. Each handler owns its own verification. |
| Data | Postgres via Supabase | RLS on every public table, plus explicit `GRANT`s. |

Single sources of truth established during the programme:

- **Discovery** — `src/lib/discovery.server.ts`. Every "what should this viewer see" question routes through it.
- **Entities** — `src/lib/entities/{kinds,parse,visibility}.ts`. One taxonomy for Works, Blog posts, Collabs, Events, Groups, Profiles across Today, DMs, Blog and Profiles.
- **Moderation** — `src/lib/moderation/service.server.ts`. Every user-generated-text write path calls it; database triggers are the backstop.
- **Messaging & notifications** — centralised pipelines, so a new surface cannot invent its own delivery semantics.
- **Errors & logging** — `src/lib/errors.ts` taxonomy plus structured op logs emitted from `src/start.ts`.

## 2. Concurrency guarantees

The operations where two users can collide were moved into single-statement-scope
Postgres routines. Each one serialises before it decides, so the decision and the
write cannot be separated by another transaction.

| Operation | Routine | Serialisation mechanism |
| --- | --- | --- |
| Event RSVP / capacity / waitlist | `reserve_event_rsvp` | `SELECT ... FOR UPDATE` on the event row, then `INSERT ... ON CONFLICT (event_id, user_id) DO UPDATE` |
| Lounge seat claim | `claim_lounge_slot` | `pg_advisory_xact_lock` keyed on the room, with stale-presence reaping inside the lock |
| Screen-share claim | `claim_lounge_screen_share` | Same advisory-lock pattern, keyed on the room |
| Open a DM thread | `get_or_create_conversation` | Ordered `(user_a, user_b)` pair plus `ON CONFLICT DO NOTHING`, so a simultaneous double-open collapses to one row |
| Redeem a Plus offer | `claim_plus_offer` | `SELECT ... FOR UPDATE` on the offer link, redemption uniqueness enforced by index |

**Verification.** `src/lib/concurrency/atomic-rpcs.test.ts` races eight signed-in
clients at a capacity-1 event, a cap-2 room, and a simultaneous двух-way DM open,
and asserts both the RPC return values and the resulting row counts. It hits a
real database, so it is opt-in and skipped by default:

```bash
RUN_CONCURRENCY_TESTS=1 \
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
bunx vitest run src/lib/concurrency
```

Fixtures (users, group, event, room) are created and torn down by the suite.

**Known limitation.** `reserve_event_rsvp` counts attendees, not `plus_ones`, so a
capacity-N event can seat more than N bodies if guests bring companions. This is
current intended behaviour — capacity is a cap on RSVPs, not on heads — and is
called out here so it is not mistaken for a race.

## 3. Security posture

- Roles live only in `public.user_roles`, checked through `has_role`. No role is ever read off `profiles`.
- Trigger functions are not callable through the API. All mutating `SECURITY DEFINER` routines are `authenticated`-only; read-only RLS predicates and genuinely public counters stay open on purpose.
- PII (guest application and guest RSVP name/email/phone/IP hash) is readable only by the owning collab owner or event creator, plus admins. No `anon` grant exists on those tables.
- `workshop_poll_votes.voter_hash` is excluded from the `authenticated` column grant, so members can tally a poll but cannot deanonymise it.
- `supabaseAdmin` is imported only inside server-function handlers, after the caller's role has been verified through the authenticated client.

The full standing rules — including what is intentionally public and which risks
are accepted — live in the project's security memory.

## 4. Performance work

- Home fan-out is parallelised and documented in `docs/home-fanout.md`.
- Index and pagination decisions are recorded in `docs/indexes-and-pagination.md`.
- Presence writes are throttled rather than emitted per keystroke.
- The group news ticker serves a cached snapshot from `public.group_news_cache` when the upstream fetch is slow or failing, so a third-party outage degrades to stale rather than blank.
- Covers carry `loading="lazy"`, explicit aspect ratios, and a typographic `CategoryPlaceholder` fallback so a missing image never renders as an empty box.

## 5. CI

`.github/workflows/ci.yml` runs on every push and pull request:

1. `bun run typecheck`
2. `bun run test` (172 tests, including the moderation engine suite)
3. lint — advisory only, given ~330 pre-existing `any` warnings
4. production build

The concurrency suite is intentionally excluded; it needs live credentials.

## 6. Open items

- Lint debt: ~330 `any` warnings. Tracked, not blocking.
- Concurrency suite runs manually against a scratch project; wire it to a nightly job once a disposable database exists in CI.
- `plus_ones` versus capacity (see §2) if event hosts start treating capacity as a head count.
