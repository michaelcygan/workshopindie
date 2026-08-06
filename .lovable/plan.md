# Keep Events inside the Group, and fix the missing open mic

Two changes: the Events tab returns to the Group page, and the recurring TBD Comedy Open Mic starts surfacing again.

## 1. Events lives in the Group view again

Right now clicking the Events tab on a Group immediately navigates away to `/g/chicago/events`. That standalone page stays, but it becomes the "see all" destination, not the entry point.

- The Events tab renders the directory inline, inside the Group shell (hero, news ticker, tab bar all stay).
- Inside the Group the directory is a preview: the heading/subheading are suppressed (the Group already names itself), filters remain, and the event list is capped at a reasonable number per section.
- A "See all events" link sits at the top-right of the tab and goes to `/g/$slug/events`.
- `/g/$slug/events` keeps its full-page treatment, big heading, breadcrumb back to the Group, SEO metadata, and shareable filter URLs.
- Legacy `?t=events` deep links keep working — they open the Group with the Events tab active instead of redirecting away.

## 2. The recurring open mic isn't showing

Confirmed cause, from the actual rows: every TBD Comedy occurrence shares one series key, and a recurring series is collapsed to a single card. The collapse currently keeps whichever occurrence appears first in the list — which is the already-finished Aug 5 date. So the whole series is represented by a past event and lands under "Past events (1)" while the upcoming Aug 12 / 19 / 26 dates disappear.

Fix: when collapsing a series, keep the nearest occurrence that hasn't ended yet; only fall back to the most recent past occurrence when the entire series is over. This is a shared helper, so the Group tab, the standalone directory, and any other rail using it all get the correct card.

## Technical notes

- `src/lib/events/filters.ts` — `collapseSeries` gains time awareness (uses the existing `effectiveEndMs` grace-window logic) and picks the representative occurrence per series rather than first-seen.
- `src/components/group/group-event-directory.tsx` — add optional `variant` ("page" | "embedded") and `limit` props: embedded hides the h1/subhead and renders the "See all" link; page keeps today's layout.
- `src/routes/g.$slug.index.tsx` — restore an events tab panel that renders `GroupEventDirectory` in embedded mode with local (non-URL) filter state; remove the tab-change and `?t=events` redirects.
- `src/routes/g.$slug.events.tsx` — unchanged apart from passing the page variant.
