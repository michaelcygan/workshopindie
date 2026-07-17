## Problem

On mobile the identity block splits across the grid in a way that makes the two circled clusters — the **left meta cluster** (`@michaelcygan · Chicago`, then the `IG @f.o.to` / `Website` pills) and the **right action stack** (`+ Follow`, then `Share` / `Report`) — read as stacked, not parallel.

Cause: only the name lives inside the 2‑column grid's left cell. The handle/city row and `LinkPills` render **after** the grid closes, as full‑width blocks below both columns. So the right stack ends near the name baseline, while the left meta starts *below* the right stack — the exact "one above the other" the annotation flags.

## Fix (mobile only, `src/routes/u.$username.tsx`)

Move the meta row and the mobile `LinkPills` **inside the grid's left column**, directly under the name. Keep them outside the grid on desktop so the `md:` layout is unchanged.

Resulting mobile left column, top → bottom:
1. `<h1>` name + `CreatorBadge`
2. Meta line: `@handle · city` (IG inline stays desktop‑only, as today)
3. `LinkPills` (IG chip + Website chip) — the exact cluster circled on the left

Right column, top → bottom (unchanged content, same widths):
1. `+ Follow` (or compact Follow + DM for mutuals; `Edit profile` for owner)
2. `Share` / `Report` pair (or `Share` alone for owner)

Because both columns now live inside the same `items-start` grid row and both stacks are ~2 items tall at similar heights, the Follow pill sits on the name line and the Share/Report pair sits on (or one hair below) the IG/Website pills line — the two circled clusters read as parallel.

### Structural moves

- Move the existing meta `<div className="mt-0.5 flex flex-wrap … text-ink-muted md:mt-1">…</div>` (lines 662–691) into the grid's left column, right after the name/badge wrapper.
- Move the mobile `<LinkPills className="mt-2 md:hidden" … />` (lines 695–699) into the same left column, right after the meta row. Keep it `md:hidden` so desktop pills continue to render in their current post‑grid position.
- After the grid closes, keep the desktop‑only branches: the meta row still renders for `md:` (either duplicate a `hidden md:flex` copy, or extract the meta JSX into a local `const metaRow = (...)` and render it once inside the mobile left column and once as `hidden md:flex` after the grid). Same for `LinkPills` (desktop copy is not `md:hidden`).
- Tighten mobile left‑column spacing: `gap-1.5` between name / meta / pills so the left stack's total height matches the right stack (Follow ~h‑9 + Share/Report row h‑8, gap‑1.5). No change to right column classes.
- No change to `FollowButton`, `MessageButton`, `ShareSheet`, `ReportDialog`, `LinkPills`, or any desktop CSS. No schema, routing, or business logic changes.

## Verification

- `/u/michaelcygan` at 360 / 375 / 390 / 430 px: the `@handle · Chicago` line sits directly under the name in the left column, the `IG` / `Website` pills sit directly below that, and their bottom edge aligns with (or sits within a few px of) the bottom of the `Share` / `Report` row on the right. The Follow pill sits on the name line.
- Mutual viewer: compact Follow + DM on the name line; Share/Report on the pills line. Still parallel.
- Owner view: `Edit profile` on the name line, `Share` on the pills line.
- `md:` and up: byte‑for‑byte identical to today (meta + LinkPills render in their existing post‑grid slots via the `hidden md:flex` copies).
