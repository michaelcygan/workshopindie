## Where the homepage refresh stands

Waves 1–4 are in and typecheck clean:

- Public vs member split (`src/routes/index.tsx` → `public-home.tsx` / `member-home.tsx`), with an auth-loading shell so members never see the logged-out page flash.
- Server aggregator `src/lib/home.server.ts` + `src/lib/home.functions.ts`: one authenticated round trip, every section fault-isolated with `Promise.allSettled`.
- "Now" (Today / Live Lounge / Next Event), "Continue making", "Stories around the Work", "Circles", People, Across disciplines.
- Route-level `head()` metadata for `/`.

What's genuinely left is Wave 5: verification and cleanup. Two concrete things I found:

1. `src/components/upcoming-in-my-groups-rail.tsx` and the `NetworkRail` data path (`getNetworkFeed`) are no longer referenced by any route — leftovers from the old monolithic index.
2. The signed-in home has never been rendered end-to-end; only the logged-out page has been confirmed serving.

## Wave 5 plan

**1. Verify the signed-in home for real**
Drive the preview with an authenticated session and screenshot at both 390px (your current viewport) and desktop. Confirm each section renders with real data or its intended empty state: Today, Lounge, Next Event, Continue making, Stories around the Work, Circles, People, Across disciplines. Check the browser console and the server-function logs for errors from the aggregator.

**2. Fix whatever that surfaces**
Most likely candidates, based on the queries written: the `group_today_posts` author join alias, the Lounge presence window, and the Event fallback chain when a member has no Groups and no home city.

**3. Remove the orphans**
Delete `upcoming-in-my-groups-rail.tsx`; drop `getNetworkFeed` only if nothing else consumes it (verified before deleting, not assumed).

**4. Mobile polish pass**
The new rails are horizontal snap-scrollers. Confirm edge bleed, snap alignment, and tap targets on 390px, and that the bottom action island never overlaps the last section (the `pb-24` on member home).

**5. Empty-state honesty**
A brand-new member with no Groups, no follows, and no Works should get a coherent page — "Now" falls back to Group discovery, "Continue making" offers first Work / complete profile. Verify that path explicitly rather than trusting the branches.

### Technical notes

No schema changes, no new tables, no migrations. All work is in `src/components/home/*`, `src/lib/home.server.ts`, and deletions of dead files.
