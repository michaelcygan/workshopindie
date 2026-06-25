## Goal
Re-skin the group news ticker so it reads as a native part of the group header — aligned, paced, and polished — without changing any data, server functions, or page structure.

## Where it lives
Keep current placement: between `GroupHero` and the sticky `GroupTabBar`, mounted from `src/routes/g.$slug.tsx`. Only `src/components/group/group-news-ticker.tsx` is edited.

## Visual design
A single contained "pill rail" that mirrors the page's content width.

```text
 ┌── max-w-7xl, px-4/6/8 ────────────────────────────────────────────────┐
 │ ●  IN THE NEWS │  Headline one • Headline two • Headline three  →     │
 └───────────────────────────────────────────────────────────────────────┘
```

- Wrapper: `mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8`, vertical rhythm `mt-6 mb-2` so it breathes between hero and tabs.
- Pill: `h-10 rounded-full border border-border bg-surface/70 backdrop-blur-sm overflow-hidden`.
- Left anchor: solid `bg-surface` chip with a 6px primary dot + uppercase tracked label "In the news" (label hidden < `sm`, dot stays). 1px divider separates anchor from rail.
- Rail: inner flex track with `gap-10` between items, 13px ink text, links underline on hover, open in new tab with `rel="noopener noreferrer ugc"`.
- Edge fades: short 32px gradients on both sides of the rail using the pill's own surface color so headlines fade into the chrome instead of being hard-clipped.

## Motion
- Speed: `duration = max(90s, itemCount * 14s)` — roughly 3× slower than today and self-adjusting so a 4-item feed doesn't whip past.
- Loop: duplicate the list once and translate `-50%` for a seamless cycle.
- Pause on `hover` AND `focus-within` (keyboard users).
- `prefers-reduced-motion`: hide the marquee and render the first 3 headlines as a static, evenly-spaced row inside the same pill.

## Behavior unchanged
- Same `fetchGroupNews` query, same 30-minute stale time, same "render nothing when empty / no URL".
- No changes to `GroupHero`, `GroupTabBar`, route, or server functions.

## Acceptance
- Ticker sits flush with hero/tab-bar horizontally at all breakpoints.
- Headlines scroll calmly; hovering or tabbing into a link pauses motion.
- On mobile the label collapses to just the dot; rail still legible.
- With reduced motion, a static 3-headline row appears in the same pill.
- No layout shift when the feed is empty (component returns `null`).
