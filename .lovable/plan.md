# Plan

## 1. "Become host" entry point that is always available

The claim-host flow today is only surfaced in narrow states (the launchpad CTA, the room-note banner when leaderless). Add an always-on entry point next to "Create a Collab".

- `src/components/create-collab-nudge.tsx`: add optional props `onClaimHost?: () => void` and `canClaimHost?: boolean`. When `canClaimHost`, render a secondary "Become host" pill beside "Create a Collab". The standalone host pill shows ~20s after entering a leaderless room (independent of the 2-min Collab timer) so the flow is always reachable. Dismissal stored as `cc-host:{roomId}` in localStorage.
- `src/routes/workshop.$id.tsx`: at the existing `<CreateCollabNudge>` mount, pass `onClaimHost` (existing handler used by `EmptyLaunchpad`) and `canClaimHost = !room.host_user_id && !!session.userId && !isHost`.

## 2. Add the "+" tool picker to the chat composer (open flow)

The "+ Tool" affordance currently lives only inside `WorkshopToolsPanel`. Put the same entry point on the chat composer so users can attach a tool without leaving chat — present in the empty/open flow too.

- `src/components/chat-mention-input.tsx`: add an optional `leadingAction?: ReactNode` slot rendered inside the input row (left of the textarea). Keep it presentation-only.
- New small subcomponent `ComposerToolButton` co-located in `workshop-tools-panel.tsx` (exported) — a 28×28 ghost pill with `<Plus />` that opens the same tools menu used by `AddToolMenu`. Reuses `TOOL_ORDER`/`PRESETS` so behavior is identical.
- `src/components/channel-view.tsx`: pass `<ComposerToolButton enabled={enabledTools} onAdd={addTool} />` as `leadingAction` on `ChatMentionInput`. Source `enabledTools`/`addTool` from the same props/handlers the parent already feeds to `WorkshopToolsPanel` (lift via new props on `ChannelView` if not already threaded; `workshop.$id.tsx` already owns both).
- Visible in every state, including the empty launchpad composer in the screenshot.

## 3. Rotate the 4 purpose tiles every 3–5s in a random sequential pattern

- `src/lib/topic-prompts.ts`: add `getPurposePool(seed, medium, size = 16)` returning a deterministic deduped pool (matched-medium first, then mix), so the rotation has fresh candidates without ever repeating one currently on screen.
- `src/components/channel-view.tsx` (`EmptyLaunchpad`):
  - Hold `visible: PurposeSuggestion[]` (length 4, seeded initial pick) plus a `pool` from `getPurposePool`.
  - Interval that randomizes between 3000–5000 ms; each tick replaces exactly one tile, cycling the slot index 0→1→2→3→0 (sequential slot, random new prompt drawn from unused pool).
  - Animate with `framer-motion` `AnimatePresence mode="popLayout"` keyed by `s.title` (220ms fade + 4px slide).
  - Pause rotation while `renaming` is true or the tile grid is hovered. Disable entirely under `prefers-reduced-motion`.

## 4. Redesign the "share to fill the room" card

`src/components/waiting-for-others-card.tsx`:

- Visuals: replace dashed pale border with `border-border/60 + bg-surface/80 backdrop-blur + shadow-lift` (matches the 2027 surfaces). Inline the live red dot beside the title (not floating).
- Seat-row visual: 5 small circles directly under the title — first as viewer's avatar/initials, rest as faint dotted placeholders — to literally show "1 of 5 filled". Adds new optional props `filledSeats?: number` (default 1) and `viewerInitials?: string`; parent in `workshop.$id.tsx` passes presence count and the viewer's initials.
- Copy: title "You're first in — invite a few people"; subtitle "Up to 5 seats. Mutuals who follow you back will see this in Live now."
- Actions: primary filled "Copy link"; secondary outline "Ping mutuals" (only when `canPingMutuals`); new tertiary text-link "Share to X" / "Bluesky" opening prefilled web-intent URLs (`window.open`, no server work).
- Inline Tooltip on a small "?" replaces the long subtitle once seats visual is present.
- Motion: stagger seat dots in on mount (60ms each); pulse the first dot once when a new presence joins. Auto-fade when `filledSeats >= 2` (parent already toggles `visible`; keep that contract, just animate out cleanly).

## 5. Small polish in the same pass

- Drop the now-duplicate "No one's hosting yet — anyone here for 60s can claim it." line from the bottom of `EmptyLaunchpad`; the persistent "Become host" pill (Section 1) and `RoomNoteBanner` cover it.
- Demote "Quieter starts? Hide this prompt" to a single small eye-off icon-button in the top-right of the launchpad area so it stops competing visually with the purpose tiles.
- All new motion (aurora, tile swap, seat-dot stagger) respects `prefers-reduced-motion`.
- Mobile: share a single fixed bottom-right container with `gap-2` so the new "Become host" pill stacks cleanly above the Collab nudge without overlap.

## Files

- Edit `src/components/create-collab-nudge.tsx`
- Edit `src/components/chat-mention-input.tsx` (new `leadingAction` prop)
- Edit `src/components/workshop-tools-panel.tsx` (export `ComposerToolButton`)
- Edit `src/components/channel-view.tsx` (`EmptyLaunchpad` rotation + composer button wiring + small polish)
- Edit `src/lib/topic-prompts.ts` (`getPurposePool`)
- Edit `src/components/waiting-for-others-card.tsx` (redesign + seat row)
- Edit `src/routes/workshop.$id.tsx` (pass new props)

## Out of scope

- No DB or server-function changes.
- No changes to the claim-host RPC or the Create-Collab flow itself — only new entry points to existing flows.
- No new prompt copy added — reuses existing `ROOM_PROMPTS`.
