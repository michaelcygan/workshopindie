# Group mobile build — what's left (Waves 4 and 5)

Waves 1–3 are in: the mobile shell, hero, section bar with honest counts and the Today signal, and the section refinements. Two waves remain, both correctness-and-polish rather than new surface.

## Wave 4 — Correctness and performance

- **Gallery ordering is honest.** The Gallery still offers a "Trending" sort that isn't backed by any engagement signal — it re-shuffles the same 48 rows. Remove the sort control and order by recency, as the section spec calls for.
- **Collabs use the canonical discovery rules.** The Collabs section filters locally (`status`, resulting work, category) instead of the shared Collab discovery predicates used everywhere else, so a Group can show a Collab that `/collab` would hide. Route the section's read through the same shared query helpers.
- **Blocked users are filtered on Group projections.** Works, Collabs, Blog and Members lists in the Group don't apply the viewer's blocked-user filter that other surfaces use. Apply it consistently.
- **Lazy-load inactive sections.** Only the active section's body should mount and fetch; the rest load on first visit. Below-fold images get explicit lazy loading and sizes.
- **Small link/state fixes.** Verify every `?t=` deep link resolves to a section that is actually visible, and clean stale values (e.g. `?t=resources` on a Group with none) back to Today.

## Wave 5 — Chicago NFC and regression pass

- Point the Chicago NFC card at the existing `/go/$slug` tracking link so scans carry attribution, and confirm a clean logged-out landing on Today with no auth wall.
- Full walkthrough at 320/375/390/430: logged out, signed-in non-member, member, steward — across Today, every section, `/g/$slug/events`, Event/Collab/Work/Blog detail, Join/Leave, and audio start/stop.
- Typecheck, tests, production build.

## Technical notes

- `src/routes/g.$slug.index.tsx`: drop the `sort` state and Trending dropdown in `GroupWorkTab`; move `GroupCollabTab`'s filter into the shared helpers already imported from `@/lib/collab/query`; wrap section bodies so inactive ones don't mount; thread `useBlockedIds` through the works/collabs/members/blog reads.
- No schema, RLS, moderation, or write-path changes. No new tables or primitives.

## Out of scope

Everything in the original v1 out-of-scope list still applies: no standalone directory, maps, resource filters, new post types, or changes to global Workshop surfaces.
