# Consolidate RSVP + Who's going

Combine the two adjacent cards on the event page into a single "RSVP" card so the action, status, and social proof share one surface.

## New single card layout

```text
┌─ RSVP ──────────────────────────────── 12 going · 2 waitlist ─┐
│ For Tue, Jul 21 · 8:00 PM               [You're going pill]   │
│ [✓ I'm in for Tue, Jul 21, 8:00 PM] [✕ Can't make it]         │
│ ─────────────────────────────────────────────────────────────  │
│ (M) (J) (A) (K) (+8)   ← overlapping avatar row, click → peek │
└────────────────────────────────────────────────────────────────┘
```

- Header: title "RSVP" on the left, going count (and waitlist if any) on the right — replaces the separate "Who's going" header and its duplicate counter.
- Body: keep the existing `EventRsvpBlock` action row and the "You're going" status pill exactly as-is.
- Footer strip: compact overlapping avatar row (h-8, -ml-2 overlap) showing up to ~10 attendees + "+N" chip, clicking an avatar opens the existing `ProfilePeek`. Empty state: "No one's RSVP'd yet — be first." (inline, small).
- Post-event: replace the footer strip with `EventWhoStrip phase="post"` inline in the same card (keeps the "who was here" recap consolidated too).
- Signed-out: show the action card + "Sign in to see who's going" inline instead of a second card.
- Keep `EventRsvpNudge` directly under the card (unchanged).
- Photos section (post-event) stays as its own separate card below.

## Files

- `src/routes/g.$slug.e.$eventSlug.tsx` — merge the two blocks (lines ~330–425) into one card wrapper; remove the standalone "Who's going" card; move the avatar rendering into the new footer strip.
- Optional small extract: `src/components/event-going-strip.tsx` for the compact overlapping-avatar row (keeps route file lean). Reuses the same `attendees` data already loaded.

No schema or query changes.
