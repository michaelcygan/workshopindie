# Groups Front Page Redesign

Turn `/groups` from a searchable directory into the front page of Workshop's creative communities — a member surface ("what's happening in my communities") and a public surface ("what communities exist, and why join"), both in the current Homepage/Blog visual language. Individual Group pages (`/g/:slug`) are untouched.

## Audit findings

What exists today at `/groups` (`src/routes/groups.index.tsx`, 593 lines, one component):
- One client query pulling up to 200 public groups, plus a second for the viewer's group ids.
- Sticky search bar at the top, kind switcher (`for-you / city / genre / micro / scene / all`), category select, sort select, featured rail, progressive Show More (24 at a time), URL-backed state (`t`, `q`, `c`, `s`).
- Showcase modules only on the pristine view: `GroupsActivityTicker`, `GroupsNewMembersRail`, `GroupsPeopleRail`, `GroupsAdjacentScenesRail`.
- Cards: `GroupCard`, `GroupFeaturedCard`, avatars via `useGroupMemberAvatars`.

What can be reused rather than rebuilt:
- `src/lib/home.server.ts` already has, server-side and batched: blocked-user set, `myGroupsFor`, `todaySummariesServer`, `myGroupLoungesServer`, `upcomingEventsServer`, `groupSuggestionsServer`, `circleStoriesServer`, and the public payload builder with a public-groups query and public Work tiles.
- `src/lib/my-groups-feed.functions.ts` (`listOpenForMyGroups`) already returns open Collabs across the caller's Groups.
- `src/routes/index.tsx` establishes the auth split: `loading → skeleton`, `user ? MemberHome : PublicHome`. Groups will mirror it exactly.
- Cache + span helpers and `supabaseAdmin`-based aggregation patterns in `home.server.ts` are the template for the new payloads.

Risks to control: N+1 per-group querying (must batch by group id array), member-only Today bodies leaking to the public page, and losing the existing URL-backed filter behaviour.

## Waves

**Wave 1 — Extract the directory (no behaviour change).**
Pull search, kind switcher, category/sort, grid, and Show More out of `groups.index.tsx` into `src/components/groups/groups-directory.tsx` (+ `groups-directory-filters.tsx`). Keep the same URL search schema and all current filtering/sorting. Verify deep links (`?t=city&c=music&s=members&q=…`) still work before anything else changes.

**Wave 2 — Route split.**
`groups.index.tsx` becomes a thin shell: auth loading → neutral skeleton; member → `MemberGroupsHome`; public → `PublicGroupsHome`. Both render the shared directory at the bottom. Search moves out of the sticky top bar into the Explore section.

**Wave 3 — Member data layer.**
New `getMemberGroupsHome()` server function (auth middleware, `supabaseAdmin`, one payload) in `src/lib/groups-home.server.ts` + `.functions.ts`, reusing the existing helpers above. It returns `{ groups, now, suggestions, communityContent }` where `now` is a normalized `GroupActivityItem[]` (`today | work | blog | collab | event | lounge`) built from batched queries keyed on the member's group ids. Ranking is deterministic: recency, with small boosts for live Lounges, events starting soon, and active Today threads, plus a cap of 2 consecutive items per Group. Blocked users filtered via the existing helper. 12 items initially, "See more" reveals the rest of a single capped fetch.

**Wave 4 — Member UI.**
`MemberGroupsHome`: editorial masthead → "Now in your Groups" (compact activity rows) → "Your Groups" (all memberships; compact grid on desktop, snap rail on mobile) → optional "From your communities" (visual Work/Blog/Collab rail, hidden if it duplicates Now) → "Groups you might like" (existing suggestion signal, with a short human reason) → "Explore all Groups" (shared directory). Zero memberships turns the page into discovery-first. Query stale time ~45s, refetch on focus, no new realtime subscriptions.

**Wave 5 — Public data layer.**
`getPublicGroupsHome()`: featured/public Groups, public Work from members of one eligible Group (chosen by data, never hardcoded), published public Blog posts from Group members, public Collabs, public Events. Public-only sources; no Today bodies. Cached like the public home payload.

**Wave 6 — Public UI.**
`PublicGroupsHome`: restrained masthead → "Creative scenes" (editorial group cards, adapted from the homepage scenes module) → "Work from [Group]" visual rail → one of Stories / Open calls / Upcoming (only where data is strong) → "Find a Group" taxonomy block with real examples per kind → shared directory → one restrained Join Workshop CTA. Every module hides itself cleanly when thin.

**Wave 7 — Mobile/responsive pass** across both surfaces, with attention to rails, filters and no horizontal page scroll.

**Wave 8 — Performance & resilience:** query counts, payload size, React Query keys/stale times, independent failure of optional modules, missing images.

**Wave 9 — Regression pass:** `/g/:slug`, join/leave, Today, Works, Collabs, Events, Lounge, directory URLs/filters/sort, homepage group modules, SEO metadata. Run the repo's typecheck/lint/build.

## Technical notes

- No new tables, no feed/activity table, no polymorphic records — `GroupActivityItem` is a server view model only.
- All member aggregation is batched by `group_id IN (...)`; no per-group loops.
- Visibility: reuse the existing group/work/blog/collab/event visibility predicates; public payload reads only public/published rows.
- Shared pieces: `GroupsDirectory`, `GroupDirectoryFilters`, existing `GroupCard` / `GroupFeaturedCard` refined, not replaced.
