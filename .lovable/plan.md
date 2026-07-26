## Add mic input selector to the Lounge

Give users control over which microphone joins the Lounge — with sensible defaults so it hardens (not complicates) the flow.

### Behavior
- Default stays browser-default; nothing changes unless the user picks a device.
- Selection persists per-browser in `localStorage` (`lounge.micDeviceId`) and is re-applied on next join.
- If the saved device is unplugged, silently fall back to default.
- Live device changes (`devicechange` event) refresh the list.
- Permission-gated: if mic permission hasn't been granted yet, the picker shows a single "Default microphone" entry (browsers hide labels pre-permission). Once granted, real labels appear.

### UI (`src/components/media-panel.tsx`)
Add a compact icon-button + dropdown next to the mic status pill in the Lounge header block (the newly freed slot shown in the screenshot):
- Trigger: chevron/`Settings2` icon button, `aria-label="Choose microphone"`.
- Uses existing `DropdownMenu` primitives — matches current design system, no new deps.
- Radio-item list of input devices; check on the active one.
- Disabled state while connecting.

### Wiring (`src/hooks/use-stream-lounge-audio.ts`)
- On connect, if a saved `deviceId` exists, call `call.microphone.select(savedId)` before `enable()`.
- Expose from the hook:
  - `micDevices: MediaDeviceInfo[]`
  - `selectedMicId: string | null`
  - `selectMic(deviceId: string): Promise<void>` — calls `call.microphone.select(id)`, persists to `localStorage`, updates state.
- Populate `micDevices` via `navigator.mediaDevices.enumerateDevices()` filtered to `audioinput`; subscribe to `devicechange`; clean up on unmount.

### Technical notes
- Stream Video SDK: `call.microphone.select(deviceId)` swaps the active input without dropping the call; safe to call while muted.
- No schema changes, no server-function changes, no new packages.
- Keeps the "auto-claim stage on connect" logic intact — selector just influences which track is published.

### Files touched
- `src/hooks/use-stream-lounge-audio.ts` — device enumeration, selection, persistence.
- `src/components/media-panel.tsx` — dropdown UI in the Lounge control row.