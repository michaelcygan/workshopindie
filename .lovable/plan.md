## Goal
Fix the clipped "I'm in for this date" button in the RSVP card and take a light mobile polish pass on the event page.

## Changes

### 1. RSVP buttons (`src/components/event-rsvp-block.tsx`) — fix the clip
The current label crams `I'm in for` + `this date` / date string into a single button, which overflows on 390px viewports and clips against the "Can't make it" button.

- Drop the inline date from the button label. Buttons become simply **"I'm in"** and **"Can't make it"** with icons.
- The date context already lives in the "For Tue, Jul 21 at 8:00 PM." helper line and the green "You're going · …" status pill above — no information is lost.
- Tighten button internals: `px-3`, `text-sm`, `min-w-0`, `truncate` on the label span, and `gap-2` on the grid so the two pills always fit side-by-side down to ~320px.
- Shorten the going-status pill on narrow widths: show just "You're going" under `sm`, keep the full "You're going · {date}" from `sm:` up (prevents the pill from wrapping under the "RSVP" heading).

### 2. RSVP card header polish
- Let the status pill wrap to its own line on mobile using a `flex-wrap` container instead of `justify-between`, so a long date never collides with the "RSVP" title.
- Reduce card padding from `p-5` to `p-4 sm:p-5` for a tighter mobile card.

### 3. Light mobile polish across the event page (`src/routes/g.$slug.e.$eventSlug.tsx`)
Small, presentation-only tweaks — no logic changes:
- **Section spacing**: reduce vertical gap between cards from `space-y-4` to `space-y-3 sm:space-y-4` so more content is visible above the bottom tab bar.
- **Location card**: on mobile, stack the copy button under the address instead of floating right, and let the address text wrap without truncation shadows.
- **"Listed in" chips**: allow horizontal scroll with `-mx-1 px-1 overflow-x-auto` so 3+ group chips don't force a second row on small screens.
- **"What people are working on" tile row**: ensure the horizontal rail uses `snap-x snap-mandatory` and `pb-2` so the peek tiles don't get clipped by the pinned bottom nav.
- **Bottom nav clearance**: add `pb-24` to the page container so the last card isn't hidden behind the floating tab bar (currently it looks like the "workshopindie.com" pill overlaps).

## Out of scope
- No changes to RSVP logic, data, or the attendee sheet.
- No desktop layout changes beyond the responsive breakpoints above.
