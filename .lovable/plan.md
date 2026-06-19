## Problem

Current `listEventAttendeeCollabs` / `listEventAttendeeWorks` sort by `created_at desc` and cap at 12 (or 48 expanded). A few prolific attendees can fill the entire grid, hiding everyone else — exactly the wrong outcome for "scan the room before you arrive."

## Goal

Guarantee every RSVP'd attendee with shareable content gets surfaced, regardless of how busy others have been, while still featuring fresh activity prominently.

## Algorithm — fair round-robin

Server-side, after fetching attendee IDs:

1. Pull a wider pool: up to **300 items** (`works` or `collab_posts`) for the attendee set, ordered `created_at desc`.
2. Bucket items by `user_id` / `created_by` in memory.
3. For each user, sort their items by recency and cap at `perUserCap` (3 default, 6 expanded).
4. Build the **fair list** with round-robin interleaving: rotate through users in order of "most recent item first", take 1 item per pass, repeat until the cap is hit or all users exhausted. This guarantees the first N slots show N distinct people.
5. Return both the fair list and the per-user buckets, plus `totalAttendeesWithContent` and `totalItems`.

Return shape:
```ts
{
  fair: Row[],                 // interleaved one-per-person rotation
  byPerson: { user: Attendee, items: Row[], remaining: number }[],
  totalAttendees: number,      // attendees with at least one item
  totalItems: number,
}
```

Both fns share the bucketing helper.

## UX

Collapsed (default — 12 slots):
- Show **fair list** — 12 distinct attendees, one item each, ordered by most-recent activity.
- Subtitle becomes: *"12 of {N} attendees sharing work · See everyone →"*

Expanded ("See everyone"):
- Switch to **By-person grouped view**, not a flat 48-card grid.
- Each person rendered as a small section:
  ```
  [avatar] @username · going          View profile →
  ─────────────────────────────────────────────────
  [card] [card] [card]   ← up to 3 collabs / 6 works visible
                          +N more on profile (if remaining > 0)
  ```
- People sorted by: most-recent activity first (same order as fair list seed).
- Horizontal carousel on mobile (snap-x scroll), 2–3 column grid on desktop.
- Tabs (Collabs / Recent work) stay, each with their own counts.

This guarantees: in the expanded view, **everyone with shareable content gets a row**. No one is invisible behind power posters.

## Empty-bucket attendees

Attendees who RSVP'd but have no public works or open collabs are still listed in the "Who's going" block above. They're omitted here by design — this section is *only* people with something to discuss. We surface the gap count with a soft prompt under the empty state: *"{N} attendees haven't shared work yet — they're listed above."*

## Tunables

```ts
const POOL_SIZE = 300;
const PER_USER_CAP_DEFAULT = { collabs: 2, works: 3 };
const PER_USER_CAP_EXPANDED = { collabs: 3, works: 6 };
const FAIR_LIST_SIZE = 12;
```

## Files

**Edit**
- `src/lib/group-events.functions.ts` — rewrite `listEventAttendeeCollabs` / `listEventAttendeeWorks` to return `{ fair, byPerson, totalAttendees, totalItems }`. Add `mode: "fair" | "byPerson"` and `perUserCap` to validator.
- `src/components/event-attendee-work.tsx` — split into two render modes (`FairGrid` and `ByPersonGroups`), CTA label changes to "See everyone (N attendees) →", subtitle copy updated.

**No DB changes. No new routes.**

## Out of scope

- Pagination beyond expanded view (group views with 100+ attendees stay scrollable; if engagement warrants, add infinite scroll later).
- Per-attendee featured/pinned item override (could be a profile-level setting later).
- "Sort by category" inside the section (the parent event already implies a focus).
