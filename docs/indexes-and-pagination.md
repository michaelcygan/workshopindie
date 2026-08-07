# Indexes, pagination, counters, idempotency (Wave 11)

## What the plans actually showed

Wave 10 left `people`, `mine` and `events` as the slowest member-home rails, so
the assumption going into this wave was that they needed indexes. The traces say
otherwise. Individual query durations cluster tightly around ~250ms, and rails
that issue several queries land on near-exact multiples of that. That is a
network round-trip floor between the app and the database, not execution time.

`EXPLAIN (ANALYZE, BUFFERS)` on the hottest read confirms it:

```text
Limit  (actual time=0.078..0.301 rows=12)
  ->  Index Scan using blog_posts_index_published_idx on blog_posts
        Index Cond: ((show_in_blog_index = true) AND (published_at <= now()))
Planning Time: 4.439 ms
Execution Time: 0.970 ms
```

One millisecond of execution behind a 250ms round trip. Current table sizes:
works 12 rows, blog_posts 114, group_events 198, instant_presence 73. Adding
indexes to tables this size would change nothing measurable — the planner
already picks index scans, and on several tables planning time now exceeds
execution time because of how many indexes exist.

So this wave adds only what pays off as data grows, and says plainly what was
skipped.

## Indexes added

- `works_public_published_idx` — `(published_at DESC NULLS LAST, id DESC)`
  partial on published + public/unlisted rows. This is the public gallery's
  exact ordering and the one hot read path with no matching index; it also
  supplies the sort key ordering that keyset pagination will need.

Nothing else was added. Every other hot query from `pg_stat_statements`
(`blog_posts` index reads, `notifications` by user + created_at,
`group_members` by user, `instant_presence` by room + last_seen,
`collab_posts` by status + created_at, `follows`, `work_credits`,
`group_events` by starts_at) already resolves through an existing index.

## Idempotency

Audited every "join / react / RSVP / apply / vouch / boost" write for a natural
uniqueness key. Already protected by primary or unique keys: `follows`,
`group_members`, `group_event_rsvps`, `work_reactions`, `work_vouches`,
`collab_vouches`, `work_boosts`, `collab_boosts`, `workshop_participants`,
`workshop_applications`, `conversations` (pair unique).

One gap found and closed:

- `event_lineup_signups` had no uniqueness on `(event_id, user_id)`. A
  double-tapped sign-up button could create two slots for one person. Added
  `event_lineup_signups_event_user_key` (unique). The table had zero duplicate
  pairs, so the index applied cleanly.

`signUpForLineup` was updated to match the new invariant: a previously
*released* slot is deleted before re-signing up (the old code relied on being
able to insert a second row), and a lost insert race — unique violation `23505`
— is treated as success rather than surfacing a database error to the person who
tapped twice.

## Counters

`groups.member_count` and similar denormalised counters are maintained by
existing triggers. No drift repair was needed: spot checks matched the
underlying row counts. Left as is rather than adding a reconciliation job for a
problem that has not appeared.

## Keyset pagination — deliberately deferred

The plan called for cursor pagination on high-growth lists. It is not
implemented, for a concrete reason: the deepest list in production is 198 rows,
and every affected list currently uses `limit` without user-driven offsets, so
there is no deep-offset scan to fix. Implementing cursors now would mean
changing route search params, loader contracts, and every rail's fetch shape to
solve a problem no query exhibits.

The prerequisite is in place: the new `works` index carries `(published_at DESC,
id DESC)`, which is the tie-broken sort key a cursor would page on. The trigger
to revisit this is any list read whose `EXPLAIN` shows rows being scanned and
discarded before the offset — worth re-checking once the largest table clears
roughly 10k rows.

## The real scaling lever

Latency here is round-trip count, not query cost. Wave 10's parallelisation cut
member-home p50 by 26% without removing a single query, and the same lever —
fewer sequential hops, more batching per hop — remains the highest-value change
until the tables are orders of magnitude larger.
