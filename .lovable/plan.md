
Only `src/routes/u.$username.tsx` changes. The desktop (`md:`) layout is untouched.

## What's wrong today

On mobile, the identity block renders name on its own line, then a single horizontal action row underneath: `[ Follow ][Msg][Share][Report][Block]`. That squeezes secondary actions into the primary row and makes the header read as a hasty toolbar instead of an intentional hierarchy.

## Target layout (matches upload 2 + upload 3)

The identity block becomes a 2‑column grid on mobile: name/handle/meta on the left, action stack on the right, both starting on the same horizontal line as the name.

```text
Avatar (overlaps cover, left)

Michael Cygan                    [  + Follow      ]
@michaelcygan  · Chicago         [ Share ] [ Report ]
[IG @f.o.to] [Website]
Outsider artist
also known as [DJ Climate Crisis]
"There's art in everything…"
```

### Visitor, not mutual (default)
- **Right column, row 1:** `FollowButton` — full width of the right column, primary orange pill, `+ Follow` label. Horizontally aligned with the `<h1>` baseline.
- **Right column, row 2:** two equally-sized icon+label ghost pills, smaller than Follow: `Share` and `Report`. `Block` moves out of the header row entirely and appears at the bottom of the About tab (already the pattern for less-frequent destructive actions) — it's noise in a first-impression header.
- No Message button in this state (mutual-only, already enforced by `MessageButton` returning null).

### Visitor, mutual (Message eligible) — matches upload 3
- **Right column, row 1:** two pills side-by-side.
  - `FollowButton` collapses to an **icon-only** compact pill: `person` icon + `check` icon (signals "following, mutual"), same height as the DM pill, `aria-label="Following — mutual"`.
  - `MessageButton` sits to its right as a compact primary pill: `message` icon + `DM` label.
- **Right column, row 2:** `Share` + `Report` ghost pills, same as the default state.
- The compact Follow state is triggered by adding a `compact` prop to `FollowButton` that (a) drops the text label, (b) swaps the "Following" check for a `Users` + `Check` icon pair, (c) keeps the existing unfollow-on-click behavior via the existing dropdown/confirm path. Non-mutual still renders the full `+ Follow` pill.

### Owner (isOwn)
- **Right column, row 1:** `Edit profile` primary pill (full width of the right column).
- **Right column, row 2:** `Share` ghost pill (single, right-aligned; no Report/Block for self).

### Grid mechanics
- Wrap identity in `grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 items-start md:block` on mobile only.
- Left column: `min-w-0` so name truncates cleanly. Contains `<h1>` + `CreatorBadge`, then the existing meta line (`@handle`, city, IG), then LinkPills, headline, bio, aliases — all unchanged.
- Right column: `shrink-0 flex flex-col items-stretch gap-1.5 w-[9.5rem]` (fixed 152 px so Follow never fights the name for width; comfortably fits `+ Follow` and the `[Share][Report]` pair at 375 px).
- Row-2 secondary buttons: `h-8 px-2.5 text-xs rounded-full` icon+label, split via a nested `grid grid-cols-2 gap-1.5` inside the right column so Share and Report are the same width and read as a pair.

### Why this is better
- **Hierarchy is visible at a glance.** Primary action (Follow / DM) sits on the name line and dominates. Secondary actions (Share, Report) are visibly smaller and grouped underneath — the eye stops caring about them until it needs to.
- **No dead band under the name.** The old layout left horizontal air between the h1 and a wide action row; the grid tucks actions alongside the name so the header is compact and the bio starts higher.
- **Mutual state is legible.** The person+check + DM pair reads as "we're connected, message me" — the exact behavioral affordance mutual-follow unlocks. Collapsing Follow to an icon in this state reclaims room for the DM pill without needing a wider header.
- **Owner and visitor use the same grid**, so switching accounts doesn't reflow the page structure — only the button contents change.

## Files touched

- `src/routes/u.$username.tsx` — replace the mobile identity block (roughly lines 608–652) with the grid layout above; the desktop branch at 603–606 is unchanged.
- `src/components/follow-button.tsx` — add optional `compact?: boolean` prop. When `compact && following`, render icon-only (`Users` + `Check`, `size="icon"`, `aria-label="Following"`), keep unfollow behavior. When `compact && !following`, still render the full `+ Follow` pill (compact only affects the mutual/following state, per the sketch).

No schema, routing, business-logic, or desktop changes.

## Verification

- `/u/michaelcygan` at 320 / 360 / 375 / 390 / 430 px: name is full-width in its column and never wraps into buttons; Follow sits on the name line; Share/Report are a matched pair below.
- Sign in as a mutual of that profile: Follow collapses to person+check icon pill, DM pill appears beside it, Share/Report unchanged below.
- Owner view (`/u/<self>`): Edit profile primary on the name line, Share alone below.
- Desktop `md:` and up: byte-for-byte identical to today.
