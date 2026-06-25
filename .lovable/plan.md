
# Pass 11 — status check

All six items shipped:

- **A.** `rsvp` auto-joins the host group on `going`/`maybe` (best-effort upsert into `group_members`). ✓
- **B.** `EventRsvpAuthSheet` + `usePendingRsvp` replay path still wired; under A the replay also joins the group. ✓
- **C.** `/events` route exists with format + when filters and SEO meta. ✓ (will get a design upgrade below)
- **D.** Attendee work rail is mounted on the event page via `<EventAttendeeWork />`, which already provides a Collabs/Works toggle and a "Show everyone" expand. This is **better than** the originally-planned separate `EventGoingCollabsRail` — one surface, two signals, no duplicate header. No additional component needed.
- **E.** Group page defaults to `collab > work > workshops > events`. ✓
- **F.** "Request to host" only renders for admins. ✓

Nothing functional left in Pass 11.

---

# Pass 11.1 — `/events` design pass

Lift `/events` to match the design language used on `/groups`, `/workshops`, and `/cities`: serif `PageHeaderCompact`, `KickerChip` eyebrow, `RecapChip` count, week buckets, and a featured row that reuses existing primitives.

## Changes (single file: `src/routes/events.index.tsx`)

1. **Header chrome — match `/groups` + `/workshops`**
   - Swap the ad-hoc `<h1>` block for `<PageHeaderCompact title="Events" backTo="/" backLabel="Home" right={…} />`.
   - Below the header: `<KickerChip live={happeningCount > 0}>{happeningCount > 0 ? "${n} happening now" : "On the calendar"}</KickerChip>` + a one-line lede + `<RecapChip count={events.length} label="upcoming" />`.
   - Right slot: pill link `Host an event → /groups` (since events are created from a group; non-admins discover groups first). Keep it as a `Button variant="outline" size="sm"` to mirror Workshops' header.

2. **Filter row — match the site's segmented control pattern**
   - Replace the local `SegToggle` with the same "rounded-full border bg-surface p-1 shadow-soft" segmented control used on `/workshops` and `/groups`.
   - Two groups, left-aligned under the header on desktop, stacked on mobile: **When** (Upcoming / Past) and **Format** (All / In person / Online).
   - Keep query state local (no URL search params for v1 — matches `/workshops`).

3. **Featured row — reuse `<FeaturedEventsCompact />`**
   - The `/groups` page already has a polished featured-events rail. Mount it at the top of `/events` (upcoming + featured only) with a `<KickerChip>Featured</KickerChip>` label, then fall through to the full grid below. Delete the ad-hoc "Featured" `<Sparkles>` block.
   - Hide the featured row when `when === "past"`.

4. **Week-bucketed grid**
   - Group results by ISO week (`This week`, `Next week`, `Week of MMM d`, …; `Past — MMM YYYY` buckets when viewing past).
   - Each bucket: small uppercase label (matches the `text-[10.5px] font-semibold uppercase tracking-[0.18em]` rhythm used by `KickerChip`) + the existing `<EventCard>` grid (3 cols desktop / 2 tablet / 1 mobile).
   - Skeletons during load: 6 `h-56` rounded-3xl shimmer tiles in the same grid (matches `/workshops`).

5. **Empty state — use `<EmptySpark>`**
   - Replace the dashed-border block with `<EmptySpark title="Nothing on the calendar." body="Scenes post events from their Group page. Find one that fits and the next thing on the books will land here." action={<Link to="/groups"><Button className="rounded-full">Browse Groups</Button></Link>} />`.

6. **SEO upgrades (head)**
   - Add `og:url`, `og:type: website`, `twitter:card`, `twitter:title`, `twitter:description` to match the `/groups` head shape.
   - Add canonical link to `https://workshopindie.com/events`.
   - Add `ItemList` JSON-LD built from the upcoming events (id, name, url, startDate, location) — emit only when `when === "upcoming"` and list is non-empty. SSR-safe (built from the same query data the component renders).

7. **YourGroupsStrip** (optional polish, low risk)
   - Mount `<YourGroupsStrip />` at the top for signed-in users, same way `/workshops` does it. Free stickiness — surfaces "your scenes" right above the public events feed.

## Files

- **Edit**: `src/routes/events.index.tsx` (only)

## Explicitly out of scope

- City filter, kind filter, calendar/month view, RSVP-from-index, map view — none for v1.
- Server-loader rewrite — keep the existing client `useQuery` for now; the data shape is small and revalidates well.
- New components — everything is composed from primitives that already exist (`PageHeaderCompact`, `KickerChip`, `RecapChip`, `EmptySpark`, `EventCard`, `FeaturedEventsCompact`, `YourGroupsStrip`).

~1 short build turn. Approve and I'll ship.
