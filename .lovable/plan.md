# Now board polish pass

Two fixes to the desktop "Now" board on the logged-in homepage: alignment and color.

## 1. Alignment

The board's wrapper uses a bare `px-4` and no page container, while every other homepage section uses `mx-auto max-w-7xl px-4 md:px-6`. That's why the board bleeds wider than the blog card above it and the "Your Workshop" grid below it.

Fix: wrap the board in the same container as the other sections so its left and right edges line up exactly with the greeting, the featured-blog card, and the section headings.

## 2. Color — return to the minimalist scheme

The board currently hardcodes a near-black panel (`bg-[#0b0b0c]`, `border-white/10`, `text-white/50`, etc.), which is why it reads as a dark-mode island on a light page. It was built that way to imitate a departures board, but it fights the site's monochrome identity.

Fix: rebuild the surface using the existing design tokens instead of hardcoded white/black values:

- panel: `bg-surface-1` (or card) with `border-border`
- lane dividers: `divide-border`
- lane label / status eyebrows: `text-ink-muted`
- item title: `text-ink`
- item detail: `text-ink-muted`
- live dot and LIVE status: keep Blueprint Cobalt `--signal` as the single accent
- header controls: neutral hover (`hover:bg-surface-2`) instead of `hover:bg-white/10`

The departures-board character stays — same three lanes, same header strip with prev/pause/next, same staggered `rotateX` flip transition, same monospaced-feeling uppercase eyebrows. Only the palette changes from inverted-dark to the site's light monochrome.

Skeleton state gets the same treatment so the loading flash isn't a black rectangle.

## 3. Load audit

Verify the board renders correctly on first paint rather than only after a refetch: check that the skeleton height matches the real board height (currently 186px skeleton vs. header + 136px body) so the page doesn't jump, and confirm no runtime errors are thrown when a lane has zero candidates.

## Technical notes

Files touched:
- `src/components/home/member-home.tsx` — container classes on the board wrapper
- `src/components/home/now-board-desktop.tsx` — token-based colors on `LaneRow`, section shell, header controls, and `NowBoardDesktopSkeleton`; skeleton height reconciled

No data, scoring, rotation, or prompt-engine changes.
