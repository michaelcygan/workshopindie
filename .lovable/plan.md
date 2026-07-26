## Wave 3: Wire the Lounge UI to the new audio API

The Stream infrastructure is in place but invisible — `media-panel.tsx` still calls the legacy `useMediaRoom` hook directly, so the new speaker queue, 20-seat capacity, and screen-share flag don't affect what the user sees. This wave connects the panel to `useLoungeAudio()` and adds the missing surface for the queue.

### 1. Rewire `src/components/media-panel.tsx` to `useLoungeAudio`

- Replace the direct `useMediaRoom(...)` call with `useLoungeAudio()` (falls through to mesh today, Stream when the flag flips).
- Map the unified `LoungeAudioApi` shape onto the existing UI:
  - `participants[]` → `SpeakerBubble` grid (drop the ad-hoc `peers` mapping).
  - `speakingUserIds` set → drives the `.speaking-halo` class we already ship.
  - `selfState` (`idle | requesting | waiting | offered | speaking | muted`) → drives the primary action button label.
  - `mute()` / `unmute()` / `leaveAudio()` / `leaveRoom()` → wire to existing controls.
- Keep the mobile chat-first auto-open behavior and the desktop join strip intact — only the data source changes.

### 2. Add the speaker-queue action strip

Replace the single "Join audio / Leave audio" button with a state machine:

| `selfState` | Primary button | Secondary |
|---|---|---|
| `idle` (listening) | "Request mic" → `requestSlot()` | — |
| `requesting` / `waiting` | "Waiting · #N in queue" (disabled) | "Cancel" → `leaveQueue()` |
| `offered` | "Take the mic" (pulsing) → `acceptOffer()` | "Decline" |
| `speaking` | Mute toggle | "Step down" → `releaseSlot()` |
| `muted` | "Unmute" | "Step down" |

Queue position comes from `participants.filter(p => p.audioState === 'waiting')` ordered by `queuedAt`.

### 3. Screen-share gating

Wrap the existing screen-share button in `LOUNGE_SCREEN_SHARE_ENABLED` from `lounge-constants`. When false (default for Stream mode until we ship SFU screen-share), the button is hidden — mesh mode keeps it on.

### 4. Capacity + roster copy

- Update "Here now" header to show `participants.length / LOUNGE_CAP` (20) instead of the hardcoded 10.
- Split the sidebar into two sections when a queue exists: **Speakers** (audioState `speaking`/`muted`, capped at `LOUNGE_SPEAKER_CAP`) and **Listeners** (everyone else), with the waiting users badged with their queue position.

### 5. Guardrails

- No changes to mesh behavior when `VITE_LOUNGE_AUDIO_PROVIDER` is unset — mesh adapter already maps its state onto the same API shape, so the new UI works identically for existing users.
- No DB changes this wave; the RPCs and columns from Wave 1 are already there.
- Deferred (call out but do not touch): the `work_applications_status_bypass` security finding and the analytics sink for `emitLoungeAudioEvent`.

### Technical notes

- `media-panel.tsx` is the only consumer that needs rewiring; `channel-view.tsx` already receives the panel as a child.
- The mesh adapter I shipped in Wave 2 maps legacy `peers`/`speaking`/`muted` onto the new API surface, so the UI rewrite doesn't regress mesh users.
- Halo animation, mobile chat sheet auto-open, and Realtime channel per-mount suffixes stay as-is.

Verification: typecheck the touched files, then load `/lounge/<id>` in mesh mode and confirm join / speak / mute / leave still work (Stream mode stays behind the flag).
