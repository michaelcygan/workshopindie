## Goal

The `/workshop/$id` live room currently stacks: page header → ChannelView (video + chat + right sidebar) → WorkshopToolsPanel below. On desktop this overflows the fold and tools get buried. Reorganize so the entire room fits one viewport, with all current functionality intact.

## Layout shift

Turn `src/routes/workshop.$id.tsx` into a viewport-locked shell:

```text
┌─ slim header row ────────────────────────────────────────────────┐
│ ← Workshop · ☕ Artist's Lounge · Live · [chip]   [Create Collab]│
├──────────────────────────────────────┬───────────────────────────┤
│  MAIN STAGE (flex-1, scrolls inside) │  RIGHT RAIL (fixed col)   │
│                                      │  ARTIST'S LOUNGE 1/5      │
│  Mode tabs: Chat · Tools · Gallery · │  [Chat|Gallery|Collabs]   │
│             Collabs                  │  Mute · Camera off        │
│                                      │  Exit Workshop            │
│  → Chat:  existing ChannelView chat  │  ─────────────────────    │
│  → Tools: WorkshopToolsPanel here    │  TOOLS (compact)          │
│  → Gallery / Collabs: same as today  │   • Pinboard  • Outline   │
│                                      │   + Add tool              │
│                                      │  ─────────────────────    │
│                                      │  IN THE WORKSHOP · 1      │
│                                      │   M  Mike Cygan (you)     │
└──────────────────────────────────────┴───────────────────────────┘
```

Wrapper: `main` becomes `h-[calc(100dvh-var(--nav-h,64px))] flex flex-col`. Header row is a single line (icon + title truncate + chips inline). Body is `flex-1 min-h-0 grid md:grid-cols-[1fr_320px] gap-4`. The main stage and right rail both get `min-h-0 overflow-hidden` so internal scroll containers (chat messages, tools list) handle overflow — outer page never scrolls on desktop.

## Tools surfaced two ways

1. **Compact Tools section in the right rail** (above "IN THE WORKSHOP"): always visible. Lists enabled tools as chips with their icon; clicking a chip activates Tools mode in the main stage focused on that tool. Empty state shows one-tap "+ Outline · suggested" / "+ Pinboard" buttons — same affordance as today, just collapsed.

2. **"Tools" as a main-stage mode**: extend the existing main-view toggle (Chat / Gallery / Collabs in `ChannelView`) with a fourth `Tools` tab. When active, the chat composer/messages area is replaced by `<WorkshopToolsPanel scope={...} />` rendered full-height inside the main stage. Chat remains one click away; media tile strip and controls stay in the rail unchanged.

Implementation: `ChannelView` already owns the Chat/Gallery/Collabs toggle (see lines 501–654). Add a `Tools` option to that toggle and a `toolsSlot?: ReactNode` prop. The route passes `<WorkshopToolsPanel .../>` as `toolsSlot`. No business logic touched in `ChannelView`; just one more case in its view switch.

## Header compression

Collapse the current two-line title block to a single row:
- Coffee icon (h-8 w-8) + title (text-2xl, truncate) + ` · Live · up to 5` muted small text + host/leaderless chip.
- "Create a Collab" stays right-aligned on the same row (icon-only on `<md`, label on `md+`).
- The Promoted banner stays where it is but becomes a slim one-liner inside the header strip when present (single row, "Open persistent room" link on the right).

## Right rail

Same components, restacked inside a single `flex flex-col gap-3` card sized to viewport:
- Room name + capacity (existing)
- View toggle (Chat/Tools/Gallery/Collabs)
- Media controls (Mute / Camera) — unchanged
- Exit Workshop — unchanged
- **Tools (compact)** — new compact renderer using the same data hooks as `WorkshopToolsPanel` (chips + add menu); no item editor here, that lives in the main stage Tools view
- IN THE WORKSHOP list — existing

If the rail exceeds viewport height on small desktop, the participants list scrolls internally inside its own `min-h-0 overflow-auto` section.

## Mobile

Below `md`, keep current stacked behavior (header → ChannelView → tools below) — single-viewport constraint only applies to `md+`. No regression on phones.

## Files touched

- `src/routes/workshop.$id.tsx` — viewport shell, slim header, grid layout, pass `toolsSlot` to `ChannelView`, render compact tools in rail.
- `src/components/channel-view.tsx` — add `Tools` to the Chat/Gallery/Collabs toggle and a `toolsSlot?: ReactNode` prop; render it when active. No other changes.
- `src/components/workshop-tools-panel.tsx` — export a small `<WorkshopToolsCompact scope={...} onOpenTool={(t) => ...} />` companion that reuses the same query/insert logic for the rail chips + add menu. Existing panel stays as-is for the main-stage view.

## Out of scope

No changes to presence, media plumbing, promotion logic, DB schema, or styling tokens. No new tool types. Mobile layout unchanged. The `Create a Collab` dialog is untouched.
