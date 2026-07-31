# Homepage Redesign — Public/Member split with a connected creative graph

## What I confirmed in the current code

- `src/routes/index.tsx` (563 lines) is one conditional monolith: a `min-h-[88vh]` marketing `Hero` with the globe + three CTA cards, then `HomePulseRail`, `HomeLiveWorkshopsRail`, `YourGroupsStrip`, `NetworkRail`, `CollabsRail`, `GalleryRail`, `FeaturedEventsCarousel`, `UpcomingInMyGroupsRail`, `CityEventsStrip`, `HomeBlogRail`. Every rail fetches on the client independently (many waterfalls).
- `src/components/home-live-workshops-rail.tsx` is still rendered for everyone — this is the legacy scheduled-Workshop rail that must not render for members.
- `useAuth()` already exposes `loading`; `index.tsx` currently ignores it, so members briefly see the public hero.
- `WorldArcs({ className, promos })` sizes from its container (`Math.max(320, r.height)`) and already checks `prefers-reduced-motion` — a compact member atmosphere is a container-size change only.
- Server helpers that already exist and will be reused/extracted: `listMyGroupLounges` (instant_rooms + presence, group-scoped), `listUpcomingForMyGroups`, `listMyUpcomingRsvps`, `listOpenForMyGroups`, `getNetworkFeed` / `getFrequentCollaborators` (plain async, already server-level), `listBlogPostsForEntityServer` (has the trusted-author rule), `getBlogPostEntityTagsBulkServer` (already batched), `blogPublicCacheHeader()`, `createMyBlogDraftServer(..., seedTag)`.
- `seedDraftTag` in `src/lib/blog-member.server.ts:160` swallows errors in a bare `catch {}` and `createMyBlogDraftServer` returns only `{ id, reused }` — Home cannot tell whether the pre-tag succeeded.
- Group Today rows (`group_today_posts`) are read client-side in `group-today-tab.tsx` with `.gt("expires_at", now)`; there is no server-level Today summary helper yet.

No schema migration is required for any of this.

## Wave 0 — Baseline

Record lint/build baseline, then write no product code. (Audit above is the deliverable; anything else uncovered mid-wave gets folded in.)

## Wave 1 — Public/Member split + atmosphere

- `src/routes/index.tsx` becomes a thin chooser: `loading → <HomeSkeleton/>`, `user → <MemberHome/>`, else `<PublicHome/>`.
- `src/components/home/public-home.tsx` — current markup moved verbatim (minus member-only branches) so the public page does not regress.
- `src/components/home/member-home.tsx` + `src/components/home/member-atmosphere.tsx` — compact 320–400px desktop / ~200–240px mobile globe band, greeting, one-line summary ("3 of your Groups are active today"), one primary action. No marketing copy, no CTA trio.
- `src/components/home/home-background-toggle.tsx` — Globe / My cover, persisted at `workshop:home-background` in localStorage. Uses existing `profiles.cover_url`; if the cover came from a Work, show a small attribution link. If no cover: globe + quiet "Set your background" → `/me/edit`. Gradient scrim for contrast; reduced-motion honored.

## Wave 2 — Now + Continue

- New `src/lib/home.server.ts` + `src/lib/home.functions.ts` exposing one authed `getMemberHome` aggregator using `Promise.allSettled` so any one module failing cannot blank the page.
  - `todaySummariesServer` — new batched query over joined groups' unexpired `group_today_posts` (count, latest snippet, author, group accent), blocked-user filtered.
  - Lounge: extract the body of `listMyGroupLounges` into a server-level function and call it from the aggregator.
  - Events: extract `listUpcomingForMyGroups` + RSVP priority into a server helper; pick one Next Event (RSVPed > joined Group > home city > online).
  - `resolveContinueActions` — deterministic, max 3: recent Blog draft → open Collab with applicants → public Work with no trusted Blog story → newly joined Group with no Today post → upcoming RSVP → profile completion (new users only).
- Components: `home/now-today-card.tsx`, `home/now-lounge-card.tsx`, `home/now-event-card.tsx`, `home/continue-making.tsx`. One primary action each; Today action deep-links to the Group with a focus param rather than duplicating the composer.
- `HomeLiveWorkshopsRail` no longer renders for members.
- Every slot has the specified productive fallback (recommend Groups, start today's conversation, open a Group Lounge, city/online event).
- Member payload cached in React Query ~45s; Lounge slice refetched ~30–45s.

## Wave 3 — Stories around the Work

- `listHomeWorkStoriesServer` in `home.server.ts`: one pass — latest ~40 eligible published posts → all work tag rows for those ids → all public/published works → all work credits → all attributed authors → trusted filter (creator, credited collaborator, or editorial/admin) → group by Work, ≤3 stories each, ≤8 composites, dedupe a post to its first eligible Work. Ranks on `published_at` / story count / work publish date — never `blog_post_entity_tags.created_at`. Public variant served with `blogPublicCacheHeader()`.
- `src/components/home/work-stories-carousel.tsx` — CSS scroll-snap rail (no new dependency), keyboard-operable, no autoplay, responsive card widths. Composite card: Work cover + credits, story title/excerpt, conservative label (Process note / From Workshop / Story about this Work), "N more stories", distinct **Read story** (opens existing `BlogPostPeek`) and **View Work** actions.
- Final participatory card: "Write about a Work" → pre-seeded draft, or "Post your first Work".
- Harden `createMyBlogDraftServer`/`seedDraftTag` to return `{ id, reused, tagSeeded: boolean }`; Home shows an honest message + manual-tag path when seeding fails.
- Invalidate the Home story query alongside existing entity-tag invalidation on blog save/publish/unpublish/delete.
- Placed high on both Public Home (after the globe) and Member Home.

## Wave 4 — Circles, people, disciplines

- `listCircleStoriesServer` — bounded 8–12 typed items (`{ kind, primary, related, occurredAt, reason, primaryAction, secondary }`) merged server-side from follows, frequent credited collaborators, joined-Group Collabs/Events, and Collab-resulting Works. Reason enum rendered as "You follow Mina" / "From Chicago Filmmakers" / "Made with Alex". Repeat-author/Group/Work caps. No new table, no infinite scroll.
- `src/components/home/people-to-make-with.tsx` — promotes the existing shared-Group people logic (as used by `groups-people-rail`), reusing `FollowButton`; excludes self, already-followed, blocked, undiscoverable.
- `src/components/home/across-disciplines.tsx` — small medium-appropriate editorial set from existing Work fields/embeds/categories; for members, 1–2 adjacent-discipline slots that require a real bridge (shared Group/city/collaborator/Blog/Event).

## Wave 5 — Consolidation and QA

- Remove member-only rendering of shelves now superseded (`YourGroupsStrip`, `NetworkRail`, member Collabs/Gallery/Events duplication) while keeping them on Public Home where they still aid discovery.
- Audit loading/empty/error/partial states, visibility + blocking, query counts (no N+1), keyboard nav, reduced motion, alt text/contrast, and 320 / 390 / 430px plus desktop.
- Run lint, typecheck, and production build after each wave; fix related failures before advancing.

## Technical notes

- Everything reads existing tables; **no migrations**.
- Reusable logic is extracted into `*.server.ts` helpers rather than calling one `createServerFn` from another.
- Home is presentation/orchestration only — no new content primitive, feed table, AI ranking, or dashboard framework.
- The typed response contract for stories/circle items is stable so a future scorer can be swapped in without UI changes.
