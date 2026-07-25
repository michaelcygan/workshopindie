# Lounge Stage Redesign — Speakers on Stage, Everyone in Here Now

## Intent

Pivot the Lounge stage away from the leftover video-tile rectangle into a purpose-built audio room. The stage becomes a compact "who's actually talking" surface; the sidebar's Here now becomes the full room roster. No two areas should show the same thing anymore.

## Roles (the mental model)

- **Stage = audio speakers only.** A participant appears on stage when they have joined audio (mic on OR muted-but-mic-active). Leaving audio → they drop off stage but stay in the room and chat.
- **Here now = everyone present in the room**, including chat-only listeners and muted people. Speakers get a small "on stage" dot so the two surfaces stay related but non-redundant.
- **Chat-only participants never appear on stage.** This is the visual payoff of the audio-first pivot.

## Stage redesign (`VideoStage` in `src/components/media-panel.tsx`)

Replace the rectangular `AudioTile` grid with a circular speaker cluster:

- **Circle avatars** sized to fill up to 10 speakers on one row on desktop, wrapping on mobile. Target sizes: `h-16 w-16` desktop, `h-14 w-14` mobile; tighten to `h-12 w-12` once 7+ speakers are present so the row never overflows.
- **Avatar source**: the profile `avatar_url` we already resolve via `profileLookup`; fallback to a gradient initial ring (same treatment used elsewhere).
- **Speaking activity ring**: keep today's speaking signal — animated primary-tinted ring + soft glow around the circle when `speaking && !muted`. Muted state shows a small mic-off badge bottom-right of the circle; no ring.
- **Name label** under each circle, single line, `truncate`, `text-[11px]`. "(you)" suffix only on the local tile.
- **Empty stage state**: when nobody has joined audio, render a quiet one-liner "Stage is quiet — join audio to speak" with a subtle mic icon, at reduced height. This kills the current large empty black rectangle when a solo chat-only user is in the room (the exact case in the screenshot).
- **Screen-share spotlight branch** (existing `sharing` code path) is preserved unchanged; the avatar row below it just swaps rectangles → circles using the same component.
- Delete/retire the `AudioTile` rectangle component (or reduce it to the new `SpeakerBubble`), keeping the exported `VideoStage` name so `channel-view.tsx` doesn't need to change its import.

## Here now (sidebar list in `MediaPanel`, ~line 203)

- Rename the label from `Here now · N` to keep it, but change what it shows: **all room participants** (chat-only + audio), not just audio peers. This is already close to what `others` provides; we just need to make sure chat-only presences are included and the local user is always first.
- Each row gets a tiny status dot next to the name:
  - filled primary dot = on stage (audio joined, unmuted)
  - hollow dot = on stage but muted
  - no dot = chat-only listener
- Remove the speaking ring from these rows — activity lives on the stage, identity lives here. This is the clean split the user is asking for.
- Keep click-to-open-profile behavior.

## Purpose split, stated for the UI

Add a one-line eyebrow on each surface so the difference is obvious at a glance:
- Stage: `SPEAKERS · N/10` (was ambient)
- Sidebar: `HERE NOW · N` (unchanged label, new meaning)

## Mute behavior

Already supported by `use-media-room` (`toggleMute`, `leaveAudio`). No logic changes — only the visual consequence changes:
- Mute → stays on stage, ring off, mic-off badge, sidebar dot goes hollow.
- Leave audio → removed from stage entirely, sidebar dot disappears, row stays.
- Join audio → appears on stage.

## Out of scope

- No changes to WebRTC, presence, chat, screen-share lease, or capacity gating.
- No changes to the header, Next Lounge / Exit buttons, tabs, or the audio controls block.
- No route/loader changes.

## Files touched

- `src/components/media-panel.tsx` — new `SpeakerBubble`, rewrite `VideoStage` grid + empty state, retitle stage eyebrow, adjust Here now rows with status dots and include chat-only presences.
- (Read-only reference) `src/components/channel-view.tsx`, `src/hooks/use-media-room.tsx` — no edits expected; verify `others` already contains chat-only presences and pass through as-is.

## Technical notes

- Speaking signal for the local user: `m.speaking && !m.muted` (existing).
- Speaking signal for peers: `peerById.get(userId)?.speaking` (existing). Peers only exist for audio participants, which is exactly what we want for the stage.
- "On stage" test for the sidebar dot: local user → `m.joined`; peer → presence in `m.peers`. Muted state for peers isn't currently transmitted, so hollow-dot state applies only to the local user for now; peer mute-vs-unmuted stays represented purely via the speaking ring on stage. (Cross-peer mute broadcasting is a separate feature and explicitly out of scope.)
