# Collapse the pre-join gate into "Drop in"

The lobby's "Drop in" button is already the user's explicit consent to join. The second "Connect" screen inside the room is a redundant step, and worse — it asks for mic OR camera based on a chosen mode. We want both, by default.

## Changes

1. **Delete `src/components/room-pre-join.tsx`** — no longer needed. The lobby ("Drop in") is the consent point.

2. **`src/components/channel-view.tsx`**
   - Remove the `RoomPreJoin` gate and its `connected` state.
   - On mount (once user is loaded), immediately call `joinWithMode("video")` so the room joins with mic **and** camera together.
   - Keep the existing in-room controls (mute, camera toggle, leave) for changing state after joining.
   - Keep the lurker presence channel as-is.

3. **`src/hooks/use-media-room.tsx`** — small adjustment to `joinWithMode`:
   - When `nextMode === "video"`, request `getUserMedia({ audio: true, video: {...} })` (already does this).
   - If the camera is unavailable / denied but mic works, fall back to voice-only with a soft toast/error rather than failing the whole join. (Currently a single `getUserMedia` failure aborts the join entirely — we'll retry audio-only on `NotFoundError` / `NotAllowedError` for the video track specifically.)
   - No changes to the TURN fallback / cost-saving logic.

4. **`src/routes/instant.$id.tsx`** — default the `mode` search param fallback to `"video"` so deep-links land in full A/V (still overridable via `?mode=voice`).

## Cost / bot-gate impact

Still preserved:
- TURN credentials are only minted lazily, after a real ICE failure (~8 s of "checking" or `failed` state). A bot that never establishes a peer connection never triggers a mint.
- The `turn_credential_grants` audit table + 10/hour rate limit stay in place.
- "Drop in" remains the human gesture required before any `getUserMedia` / signaling / mint can occur, so it still acts as the bot gate — we're just merging it with the room entry instead of asking twice.

## Files

- delete: `src/components/room-pre-join.tsx`
- edit: `src/components/channel-view.tsx` (remove gate, auto-join with video mode)
- edit: `src/hooks/use-media-room.tsx` (graceful camera-denied → voice fallback)
- edit: `src/routes/instant.$id.tsx` (default mode to `video`)
