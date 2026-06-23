## Top nav restructure

Resolve the "Workshop" naming collision and reorganize the desktop top bar into three justified zones.

### Layout

```text
[ ● Workshop ]            [ Workshop · Collabs · Groups · More ▾ ]            [ + Create · ✉ · 🔔 · 👤 ]
   left (home)                       center (primary nav)                          right (actions)
```

- **Left — brand wordmark (home)**: the existing orange gradient dot + the wordmark "Workshop" rendered in the display serif. Whole unit is a single `<Link to="/">` with `aria-label="Home"`. This is the only thing on the left.
- **Center — primary nav**: `Workshop · Collabs · Groups · More ▾`, horizontally centered in the bar. "Workshop" here keeps its label (per your answer) and links to `/workshop`. Visual differentiation from the brand comes from: (a) serif wordmark on the left vs. sans pill buttons in the center, (b) physical separation across the bar, (c) active-state pill on the page button when on `/workshop`.
- **Right — actions**: `+ Create` dropdown, Messages, Notifications, avatar menu. Unchanged from today, just pinned right.

### How the three zones are achieved

Single flex row with three children, each `flex-1`:
- left: `justify-start`
- center: `justify-center`
- right: `justify-end`

This keeps the center nav truly centered in the viewport regardless of left/right widths (better than `ml-auto` for symmetry).

### Disambiguation rules

- Brand wordmark uses `font-display` (serif), normal weight, ~18px, tracks tight. Page-button "Workshop" uses the existing `navLinkBase` sans pill, 14px.
- Brand wordmark never shows an "active" treatment when on `/workshop` (only the center button does), so the two never light up together.
- Hovering the brand shows a subtle muted background on the whole `● Workshop` unit; hovering the center button shows the pill background only on that word.

### Mobile

No change to `mobile-nav.tsx` in this pass — the bottom tab bar already reads `Workshop · Collabs · Groups · More · You` with no brand collision.

### Files

- `src/components/top-nav.tsx` — restructure the header into three justified flex zones; replace the dot-only home link with a `● Workshop` wordmark unit; keep the center nav (Workshop / Collabs / Groups / More) and the right action cluster intact.

No other files change. No data, route, or business-logic changes.
