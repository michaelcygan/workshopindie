## Lounge sidebar button updates

Three small presentation-only tweaks to the Lounge UI. No business logic changes.

### 1. Move "Next Lounge" into the Lounge sidebar module (orange)

- In `src/components/media-panel.tsx`, accept a new optional `nextLoungeSlot?: ReactNode` prop on the Lounge sidebar panel and render it at the top of the panel (above the Mute / Camera off row), full-width.
- In `src/routes/lounge.$id.tsx`, remove the `<HopButton>` from the top-right header row and instead pass it into the `ChannelView` via a new `nextLoungeSlot` prop, which forwards to `MediaPanel`.
- In `src/components/hop-button.tsx`, add an `orange` visual style: solid orange background, white text, rounded-full, full-width when used inside the sidebar (accept an optional `fullWidth`/`variant="sidebar"` prop rather than hardcoding). Orange uses the existing brand orange token already used by the "Create" button in the top nav — no new color tokens.

### 2. Make "Exit" a red button

- In `src/components/media-panel.tsx`, restyle the existing Exit button from a text-only destructive link into a solid red pill button: red background, white text, rounded-full, same width behavior as the Mute/Camera buttons. Uses the existing `destructive` token.

### 3. Give "New Collab" more prominence (keep in current spot)

- In `src/routes/lounge.$id.tsx`, keep the "New Collab" button in the top-right header (unchanged location), but restyle it from the current muted text link into a proper outlined pill: `rounded-full`, visible border (`border-border`), stronger text color (`text-ink` instead of `text-ink-muted`), subtle hover, matching the sizing of the sibling `HopButton`/`End` pills so it reads as a real UI control instead of an afterthought. Rocket icon stays.

### Technical details

Files touched:
- `src/components/media-panel.tsx` — add `nextLoungeSlot` prop; restyle Exit button.
- `src/components/channel-view.tsx` — thread `nextLoungeSlot` prop through to `MediaPanel`.
- `src/routes/lounge.$id.tsx` — remove `HopButton` from header, pass it into `ChannelView`; restyle "New Collab" button.
- `src/components/hop-button.tsx` — add sidebar/full-width orange variant (keeps existing outline usage elsewhere intact if any).

No new dependencies, no schema changes, no server function changes.
