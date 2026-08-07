# Waves 12–14 — Errors, observability, security, and the launch report

Final three waves of the backend consolidation pass. Product, design and navigation stay frozen; every change is under the surface.

## Wave 12 — Error taxonomy and observability

`src/lib/errors.ts` already defines the ten canonical codes (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `ALREADY_EXISTS`, `FULL`, `CLOSED`, `RATE_LIMITED`, `MODERATION_BLOCKED`, `INVALID_INPUT`, `CONFLICT`) and a `DomainError` class — but only the messaging pipeline imports it. Everything else throws bare `new Error("...")`, so a capacity rejection and a genuine bug look identical in logs.

What changes:

- Adopt `DomainError` across the high-value write paths: RSVP and lineup sign-up, room join, workshop seats, DM open, collab and workshop lifecycle transitions, auth guards, and the atomic RPC callers. Each throw keeps the exact message the screen shows today, and gains a code.
- Map the RPC status strings the Wave 4/5 functions already return (`full`, `closed`, `forbidden`, `already_joined`) onto the matching codes in one place, so a new caller cannot invent a different phrasing.
- One structured log line per server operation: operation name, entity type and id, duration, result code, whether the caller was authenticated. Never message bodies, emails, or tokens. Same `[perf]`-style single-line JSON the tracer already emits, so both are greppable together.
- Wire the log emitter into the existing `errorMiddleware` in `src/start.ts` so unhandled failures are recorded with a code of `UNHANDLED` instead of a bare stack.

Not doing: an external error-tracking service, a new UI error surface, or changing a single user-visible string.

## Wave 13 — Security pass and CI

Two parts.

**Review.** A targeted pass over the places where the caller supplies an id and the server then acts with privilege: admin and cron routes under `/api/public/*`, storage bucket policies, draft and soft-deleted content visibility, and the remaining service-role call sites. Anything the scanner flags gets fixed or explicitly documented as not applicable. The known open item — 154 pre-existing linter findings, mostly `SECURITY DEFINER` functions callable by anonymous visitors — gets triaged into "must revoke", "intentionally public", and "already gated internally", with the first group fixed in one migration.

**CI.** There is no CI configuration in the repo today. Add a GitHub Actions workflow running typecheck, lint, the unit tests, and a production build on every push. Two blockers to clear first:

- `package.json`'s test script excludes `src/lib/moderation/engine.test.ts`. That file is a hand-rolled assertion script, not a vitest suite, so it fails with "No test suite found". Convert it to real `describe`/`it` tests and drop the exclusion — moderation is the one thing that should never regress silently.
- The Wave 10 measurement harness stays opt-in behind `PERF_TRACE=1` so CI never depends on the live database.

## Wave 14 — Launch report

The plan's original Stage A–E load test (up to 5,000 concurrent) is not something this environment can honestly produce: the traces show a ~250ms network round-trip floor from the sandbox, and the database is a shared development instance whose largest table holds 198 rows. A synthetic 5,000-user run against it would measure the sandbox, not Workshop.

Instead:

- **Targeted concurrency tests** on the invariants Waves 4 and 5 added — N simultaneous requests for one workshop seat, one event's last RSVP slot, one lineup slot, a room at capacity, and both sides opening the same DM at once. These prove the atomic RPCs hold, which is what the load test was really for.
- **A measured baseline** rather than a projected one: p50/p95 per surface from the existing tracer, query counts, and the round-trip floor documented as the current limiting factor.
- **The final report** (`docs/launch-report.md`): what was consolidated, what was removed, the concurrency bugs found and fixed, invariants added, performance before/after, security posture, what was deliberately left alone and why, real limits, and recommended configuration for launch / 10k DAU / 100k DAU.

## Also folded in

The `/blog` page currently throws a React hydration error: `formatDate` in the public story components calls `toLocaleDateString` with no timezone, so the server renders the UTC date and the browser renders the viewer's local date ("August 2" vs "August 3"). Fix by formatting publish dates in a fixed timezone across the four affected components.

## Technical notes

- Files touched: `src/lib/errors.ts`, a new `src/lib/obs/log.server.ts`, `src/start.ts`, the write-path server functions listed above, `src/lib/moderation/engine.test.ts`, `package.json`, a new `.github/workflows/ci.yml`, the four date-formatting components, and `docs/launch-report.md`.
- One migration expected in Wave 13, revoking anonymous `EXECUTE` on the trigger and internal helper functions that do not need it.
- Verification between waves: `tsgo --noEmit`, `eslint .`, `bun run test`, and a production build.
