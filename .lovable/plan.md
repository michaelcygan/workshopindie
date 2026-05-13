
# Instant v2 — Lounge or Work

## The mental model

Drop the side-by-side "Lounge / Tonight" tabs. Replace with a single up-front choice the moment someone taps Instant:

```text
                  What do you want to do?

   ┌──────────────────────┐   ┌──────────────────────┐
   │  Artist's Lounge     │   │  Work                │
   │  Hang, talk, meet    │   │  Make something now  │
   │  • 4 around          │   │  • 3 lobbies live    │
   └──────────────────────┘   └──────────────────────┘
```

Two verbs, no jargon. "Tonight" goes away — it was a time filter pretending to be a place. Urgency belongs *inside* Work lobbies ("ship by midnight").

## Artist's Lounge — one room, always on

- Single global room. No categories, no sub-channels. The whole point is collisions across mediums.
- Persistent text + ambient voice (what we have).
- Soft "I make…" chips on each person in the Around list (Music / Film / Writing / Visual / Build) sourced from their profile — flavor, not a filter.
- Around list rows link to `/u/$username` (fixes the bug you flagged).

Why one room: at small scale, fragmenting kills the room. One lounge that's *sometimes* alive beats five that are *always* dead.

## Work — task-based instant lobbies

This is the new primitive. A Work lobby is a lightweight, time-boxed "I'm making X right now, join me."

**Spawn flow (3 fields, ~10 seconds):**
1. Medium (one of 5: Music / Film / Writing / Visual / Build) — restrained on purpose.
2. Prompt (one line: "Making a track, uploading to SoundCloud by midnight").
3. Ends in: 2h / 6h / Today / 24h.

That's it. No title, no description, no cover. Lobby auto-closes at the deadline.

**Browse:**
```text
WORK · LIVE NOW
┌─ MUSIC ────────────────────────────────────┐
│ "Making a track, SoundCloud by midnight"   │
│ jess · 2 in · ends 11:59pm  [Join]         │
├─ WRITING ──────────────────────────────────┤
│ "Cowriting a short, need a second voice"   │
│ sam · 1 in · ends in 4h     [Join]         │
└────────────────────────────────────────────┘
```

Filter chips at top = the 5 mediums + All. Nothing else. The collaboration scope is whatever the participants negotiate inside.

**Inside a lobby:** chat + voice + video, same shell as Lounge but with the prompt pinned at top and a "Mark shipped" button that posts the result back to the spawner's profile (later — out of scope for this pass).

**Cap:** 6 per Work lobby (smaller than Lounge's 8 — collab needs intimacy).

## Voice & Video — the awkwardness question

The honest tradeoff: forcing video kills participation; forbidding it kills depth. So **per-user opt-in, per-medium**.

**Rules:**
- Every room (Lounge + Work) supports voice *and* video on the same WebRTC mesh.
- Each user independently chooses their state: **🎧 Listening / 🎙️ Voice / 📹 Video**. Three buttons, one row. Tap to cycle up, tap mic/cam icon to drop back.
- Default on join = **Listening** (no mic, no cam). Lowest-stakes entry. You can lurk for 30 seconds, then unmute.
- Video tiles only render for people who opted into video. Voice-only people show as avatar tiles with a speaking ring (what we have). Listeners show in a small "👂 3 listening" pill — they're present but invisible.
- No "video required" rooms. Forcing camera on strangers is the awkward path.

**Why this works for collab without being weird:**
- The asymmetry is fine. A producer can be on cam showing their DAW while a writer stays voice-only. Nobody owes the room their face.
- The progression (listen → talk → show) matches how trust actually builds in 5 minutes with strangers.
- One UI for both Lounge and Work — no mode-switching cognitive load.

**Mesh cap implication:** video is bandwidth-heavy. Hard cap video tiles at 4 simultaneous in any room (first 4 to enable). 5th person to hit video gets "Voice only — room is at video capacity." Keeps the mesh viable until we add an SFU.

## Around list

- Each row → `<Link to="/u/$username">`.
- Show medium chip + city if profile has them.
- Click avatar = profile, hover = quick peek (later).

## Routes

- `/instant` — the chooser (Lounge | Work).
- `/instant/lounge` — the one Lounge room.
- `/instant/work` — Work lobby browser + spawn button.
- `/instant/work/$id` — a specific Work lobby.
- `/instant/work/new` — spawn form (modal on desktop, full page on mobile).

Old `/instant/$id` stays as a redirect for any stale links.

## Migration shape

- Keep `instant_rooms` table. `kind` column: `'lounge' | 'work'`. Seed one `lounge` row.
- Work rooms: add `medium`, `prompt`, `ends_at`, `creator_id`, `participant_cap` (default 6).
- A scheduled cleanup (cron or on-read) hides rooms past `ends_at`.
- Voice signaling channel keying stays the same (`voice:$roomId`).

## Technical notes

- The "cannot add presence callbacks after subscribe()" error in your second screenshot is a real bug in `use-voice-room.tsx`: the lurker channel registers `.on('presence', …)` *after* `.subscribe()` in some hot-reload paths. Fix by chaining `.on(...).on(...).subscribe()` in one expression and never re-subscribing the same channel ref.
- Video pass extends `useVoiceRoom` → `useMediaRoom(roomId, { audio, video })`. Same RTCPeerConnection mesh, addTrack for video when toggled on, replaceTrack when toggled off (don't tear down the PC).
- Video tile component is new (`<VideoTile peerId stream />`); reuses the speaking ring.

## What ships in this pass

1. Replace `/instant` with the two-card chooser.
2. Build `/instant/lounge` (rename of current channel view, Lounge-only).
3. Build `/instant/work` (browser + spawn) and `/instant/work/$id` (lobby).
4. Migration: add `kind`, `medium`, `prompt`, `ends_at`, `creator_id`, `participant_cap`; seed Lounge; drop Tonight.
5. Add video to `useMediaRoom` (extend, don't replace) with the 3-state Listen/Voice/Video control.
6. Around list rows link to `/u/$username`.
7. Fix the presence-callback subscribe-order bug.

## Out of scope (next pass)

- "Mark shipped" → profile artifact post.
- Quick-peek hover cards on Around.
- SFU upgrade when video demand outgrows mesh.
- Notifications when a Work lobby in your medium spawns.
