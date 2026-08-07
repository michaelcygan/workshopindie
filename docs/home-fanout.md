# Home fan-out — measurement and reduction (Wave 10)

Everything below was measured against the live database with the query tracer in
`src/lib/perf/query-trace.server.ts`. Reproduce with:

```bash
PERF_TRACE=1 bunx vitest run src/lib/perf/measure-home.test.ts
```

Five runs per surface; durations in milliseconds. `dbMs` is the sum of query
durations, so it exceeds wall time whenever rails run in parallel.

## Before

| Surface | p50 | p95 | queries | dbMs (median) |
| --- | --- | --- | --- | --- |
| Public home (logged out) | 749 | 1544 | 10 | ~1860 |
| Member home (logged in) | 1715 | 1797 | 42 | ~8100 |

Slowest rails, member home: `circle` 1091, `events` 780, `people` 610,
`mine` 607, `continue` 532, `featuredBlog` 398.
Slowest rail, public home: `publicStories` 986 (five chained queries).

Exact-duplicate queries (same table, same filters, same values) in one request:
**none**. An earlier signature-only pass suggested eight duplicates; adding
filter values to the key showed those were distinct lookups. No de-duplication
work was warranted.

## What was changed

1. **Circle rail — removed a serial hop.** `follows` and the viewer's own
   `work_credits` were fetched one after the other despite being independent.
   They now issue together; the collaborator lookup still waits on credits
   because it depends on them.
2. **Blog rail — taken off the serial tail.** `blogRailServer` ran after the
   whole rail batch resolved, purely because it filtered out featured/mine ids
   in memory. The query never depended on those ids, so it moved into the
   parallel batch and the exclusion is applied afterwards.
3. **Public home — 60s cached read.** The logged-out payload is identical for
   every visitor. `getPublicHomeServer` now goes through a single-flight TTL
   cache (`src/lib/perf/ttl-cache.server.ts`); concurrent cold requests collapse
   into one build, and a failed rebuild serves the previous value rather than
   erroring.

## After

| Surface | p50 | p95 | queries | notes |
| --- | --- | --- | --- | --- |
| Public home, cold | 764 | 1214 | 10 | unchanged work, lower tail |
| Public home, warm | 0 | 0 | 0 | served from the 60s cache |
| Member home | 1275 | 1773 | 42 | −26% p50 |

Member-home rails after the change: `people` 1237, `mine` 936, `events` 726,
`circle` 624 (was 1091), `disciplines` 569, `continue` 537.

## What was deliberately left alone

- **Query count (42) is unchanged.** No rail showed an N+1 pattern: each is a
  fixed set of batched `in (...)` lookups. Collapsing further would mean
  merging unrelated rails into database views, which trades explainability for
  latency the numbers do not justify.
- **`people` and `mine` are now the slowest rails.** Both are already single
  batched passes; their cost is raw table scan time and belongs to Wave 11
  (indexes from real `EXPLAIN` plans), not to query restructuring.
- **Failure behaviour is unchanged.** Rails still resolve through
  `Promise.allSettled`; Home renders with a rail missing rather than erroring.

## Tracing in production

`withTrace` is inert unless sampling is switched on:

- `PERF_TRACE=1` — trace every request.
- `PERF_TRACE_SAMPLE=0.05` — trace 5% of requests.
- unset or `PERF_TRACE=0` — no tracing (one async-storage lookup per query).

Each traced request emits one structured `[perf] {...}` line containing totals,
the slowest queries, exact duplicates and per-rail durations. No user content is
logged.
