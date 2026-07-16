# Mobile profile: lift Featured above the fold

Scope: `src/routes/u.$username.tsx` only. Every change is gated with mobile‑only classes (`md:` restores the current desktop look 1:1). No data, query, or business logic changes.

## Goals

1. On a 390px viewport, the "Featured" strip (and, when it fits, the medium chip bar) is visible without scrolling — so a profile scanned in‑person or from a link‑in‑bio instantly reads as "real portfolio."
2. Keep the design minimal and distinct: identity block stays elegant, just denser and more purposeful.
3. Rename user‑facing copy "Pinned" → "Featured" on the profile.

## What changes (mobile only)

### 1. Cover + avatar (line ~461, ~521)
- Cover height `h-40` → `h-32` on mobile (`md:h-80` unchanged). Reclaims ~32px.
- Avatar overlap `-mt-10` → `-mt-8` on mobile; avatar size `h-20 w-20` → `h-[72px] w-[72px]` on mobile. Frees another ~12px and lets the action buttons sit tighter.

### 2. Identity block (line ~562–634)
- Wrapper `mt-4` → `mt-3` mobile.
- Name `text-2xl` → `text-[22px] leading-tight` on mobile.
- Meta row (`@handle · city`) unchanged in content, but `mt-1` → `mt-0.5`.
- Headline "Outsider artist": `mt-2 text-sm` → `mt-1.5 text-[13px]` on mobile.
- LinkPills `mt-3` → `mt-2` mobile.
- Bio: `mt-3 line-clamp-3` → `mt-2 line-clamp-2` on mobile (desktop unchanged; it lives in About).
- Aliases row: `mt-3` → `mt-2`, and cap to first 2 aliases inline on mobile with a `+N` chip that opens About; unchanged on desktop.

### 3. Artist statement (line ~679)
- Currently `mt-6 … text-lg italic md:text-2xl` — very tall on mobile.
- Mobile: `mt-3 text-[15px] leading-snug line-clamp-2` with a subtle tap‑to‑expand (`aria-expanded` toggle, no library). Desktop unchanged.
- This is the single biggest above‑the‑fold win.

### 4. Tab bar + tab content spacing (line ~707, ~729)
- Sticky tab bar `mt-8` → `mt-4 md:mt-8`.
- Tab content wrapper `py-8 pb-20` → `py-4 pb-24 md:py-8 md:pb-20`.

### 5. Featured section (PinBar, line ~982–1003)
- Rename the heading `Pinned` → `Featured` (line 1003). This is the only copy string; internal identifiers (`pinnedWorks`, `PinBar`, `pinned_work_ids`, DB columns) stay untouched.
- Tighten section top spacing on mobile so the heading + first row of covers appear immediately after the tab bar.
- Reduce mobile cover grid gap from default to `gap-2` on mobile; keep desktop as-is. Featured Works and Featured Collabs stay side‑by‑side categories exactly as today.

### 6. Medium chip scroller (line ~866)
- `mb-4` → `mb-3` on mobile, and move the scroller so it sits *directly above* the category tiles (no change in DOM order, just tighter margin). The auto‑scrolling pill bar already exists; this just gives it a better neighborhood.

## What does NOT change

- No changes to queries, fetchers, PinBar internals, Category tiles logic, or desktop layout.
- No changes to routing, tabs list, or default tab.
- No new components, no new dependencies.
- Backend, RLS, and moderation untouched.

## Estimated above‑the‑fold gain @ 390×735

Rough budget (px) reclaimed vs. current:
```text
cover                 ~ 32
avatar/actions row    ~ 12
identity spacing      ~ 18
headline size         ~  6
bio clamp (3→2)       ~ 20
artist statement      ~ 60  (biggest single win)
tab bar mt            ~ 16
py-8 → py-4           ~ 16
                     -----
                    ~ 180 px
```
That's enough to bring the "Featured" heading + a strip of thumbnails (and, on many profiles, the medium chip bar too) above the fold on a 390×735 iPhone.

## Files touched

- `src/routes/u.$username.tsx` (spacing/typography classes + one copy string)

## Verification

- Preview at 390×735: confirm `Featured` heading is visible without scroll, thumbnails start to peek, tab bar remains sticky.
- Preview at ≥768: confirm layout is byte‑equivalent to today (all edits gated by `md:`).
- Search the repo for user‑visible "Pinned" on the profile route — only the PinBar `<h2>` should change; workshop/group/room pins keep their own copy.
