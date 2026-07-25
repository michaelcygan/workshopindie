Fix the Lounge "Here now" sidebar so it renders in both chat-only and audio-joined states.

Change in `src/components/media-panel.tsx` (the `AudioSidebar` section that switches on `m.audioJoined`):

- Move the "Here now" block (the `<div className="border-t …">` containing the heading and `<ul>` of `SpeakerRow`s for me + others) OUT of the `m.audioJoined` branch so it renders unconditionally, right after the participation controls.
- Also move the screen-share info pill and the `m.error` line out of the branch, so chat-only users get the same status context.
- Keep the branch limited to what's actually state-specific: the "You're here through chat / Connecting…" copy + Join audio/Exit buttons vs the Mute/Leave audio + dockExtra/Exit rows.

Result: as soon as a user drops in (chat-only, muted, or on stage) they and every other present user appear in the Here now list, matching the `totalHere` counter in the header.