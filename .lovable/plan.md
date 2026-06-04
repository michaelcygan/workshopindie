# Tools — V1 Primitives (final)

Frame unchanged: **Workshop** = the live room. **Work** = the persistent project (rights-baked-in at creation, private by default with public-apply + invite-link options).

V1 ships these as **tool primitives** — solid, working foundations we iterate on with real usage. No transcription, no AI post-processing in v1; both can layer on cleanly later because the recording + storage primitives are designed for it.

---

## Workshop live-room tools (V1)

### 1. Multi-Track Local Recording — the headline
Each participant's browser records **their own mic and camera locally** via `MediaRecorder`, producing clean, full-quality stems uncoupled from WebRTC compression. Chunks upload in the background; on stop, the Work's File Drop has individual tracks (`alice.wav`, `bob.webm`, ...) plus a rough mixdown for instant playback.

- **External device support**: USB mics, audio interfaces, external cams all appear in a device picker (`navigator.mediaDevices.enumerateDevices()`).
- **Sync**: every chunk stamped with `performance.now()` offsets keyed to a shared session start; server reconstructs the timeline.
- **Resumability**: chunks upload every 5s — a browser crash costs at most one chunk per person.
- **Consent ledger**: record can't start until every participant clicks "I consent." Logged in `work_activity`.
- **Cap**: 2 hours / session in v1; revisit on paid tier.
- **Future-ready**: tracks are stored as individual files keyed to a `session_id`, so transcription, AI summaries, and stem processing all drop in as separate jobs reading the same primitive.

### 2. Screen Share with Viewer-Side Toggle
WebRTC second outgoing track via `navigator.mediaDevices.getDisplayMedia()`. The presenter's webcam **keeps streaming** alongside the screen.

- **Each viewer independently chooses** what to feature for that presenter: **Screen** or **Webcam**. A small toggle on the presenter's tile, local state only — Alice can watch the screen while Bob keeps watching the presenter's face. Picture-in-picture available as a third option.
- One screen presenter at a time (queue if a second person clicks Share).
- "Share audio" toggle for system audio (Chromium-only, hidden gracefully elsewhere).
- Screen recorded as its own track in the multi-track session.

### 3. Demo — bookmark-to-clip
During a session, any participant presses **`B`** (or the Demo button) to drop a timestamped marker. After the session, the system auto-generates short clips (default 30s before → 30s after each marker) into the File Drop, ready to share or embed.

- Why "Demo": fits the platform — these are the moments worth showing off, the demo-day cuts, the "watch this part" sends. Single-syllable, verb-ish, brandable.
- Anyone can drop a Demo; label is optional. Owner can edit / trim / delete after the session.

### 4. Teleprompter Overlay
A scrollable script panel pinned over the presenter's own video preview (only they see it). Auto-scroll speed, font size, mirror mode. Loads from any Notepad doc in the Work. Big value for podcast intros, scripted video, pitch practice.

---

## Work persistent tools (V1)

Unchanged from v2:

- **File Drop** — 2 GB / Work, drag-drop, version history, **time-coded comments on audio (waveform) and video (frame scrubber)** — the async wedge.
- **Notepad** — Tiptap + Supabase Realtime presence + debounced saves; multiple docs per Work.
- **Task list** — checkable items, assignees, due dates.
- **Links board** — pinned URLs with categories.
- **Activity feed** — every meaningful action.
- **Rights & Splits panel** — read-only view of the current agreement + amendment history.

Category presets per medium (music / film / hackathon / writing) pre-enable the right tile set with sensible labels.

---

## Work creation flow (the deal-memo gate, unchanged from v2)

Single-screen, required at promotion-from-Workshop and at scratch-creation:

1. Title, category, short description
2. **Visibility** — Private (default) · Open to applicants · Invite link only
3. **Rights & Splits** — License (CC variants / ARR / Custom), Credit template, Splits %, Commercial use
4. **Sign** — owner clicks "I agree" → snapshot written to `work_agreements` with content hash + timestamp; every joiner signs the active snapshot

---

## Per-user independent tool views (unchanged)

Tool selection is local URL state (`/work/{slug}/tools/{tool}`). Tool data is real-time per-tool via Supabase Realtime channels. Per-tool presence dots on the tile grid ("3 in Notepad, 1 in Files").

---

## What's explicitly NOT in V1 (deferred to v1.1+)

- Live transcription / live captions
- AI session summaries, chapters, show notes, episode titles
- CRDT for Notepad (last-write-wins in v1)
- Whiteboard
- Polls / decisions log
- Stem isolation, multi-cam director switcher
- Tiptap suggestion mode (track-changes)

All of these layer cleanly on top of the V1 primitives — recordings are already per-track and per-speaker, Notepad is already real-time, Demo clips are already discrete files.

---

## Architecture sketch

```text
Workshop (live room)
┌──────────────────────────────────────────────────┐
│  ┌────────────────┐  ┌──────────────────────┐   │
│  │ Alice [Cam ▾]  │  │ Bob is sharing       │   │
│  │  (cam feed)    │  │ [Screen | Cam | PiP] │   │
│  └────────────────┘  └──────────────────────┘   │
│                                                  │
│  [● Record (multi-track)]  [Share screen]       │
│  [B Demo]  [Teleprompter ▾]  [Mic: USB ▾]      │
│                                                  │
│  "Turn into a Work →"                           │
└──────────────────────────────────────────────────┘
        │  on Stop Record
        ▼
Work › Files: alice.wav · bob.wav · screen.webm · rough-mix.mp3
Work › Files: demo-01.mp4 · demo-02.mp4 (auto-generated)
Work › Activity: 2 demos · 1 recording (28 min)
```

---

## Schema sketch (build phase)

- `work_collaborators`, `work_agreements`, `work_agreement_signatures`
- `work_files` + `work-files` Storage bucket (private, RLS on `work_collaborators`)
- `work_file_comments` (file_id, user_id, timecode_ms, body, resolved) — time-coded scrubber pins
- `work_docs`, `work_tasks`, `work_links`, `work_activity`
- `work_invites`, `work_applications`, `work_invite_tokens`
- `workshop_sessions` (workshop_id, started_at, ended_at, consent jsonb)
- `workshop_session_tracks` (session_id, user_id, kind ['mic','cam','screen'], file_id, t0_ms, dur_ms)
- `workshop_session_demos` (session_id, user_id, t_ms, label)
- `promote_workshop_to_work(workshop_id)` RPC

---

## V1 ship order

1. Workshop: Screen Share + viewer-side toggle (Screen / Cam / PiP)
2. Work creation flow (deal-memo: visibility + rights & splits) + Work shell
3. Universal async tools: File Drop with time-coded comments, Notepad, Tasks, Links, Activity, Rights
4. Multi-track local recording + consent ledger + chunked resumable upload + post-session stitch
5. Demo (bookmark-to-clip) — runs as a server fn after Stop Record using WebCodecs in-Worker
6. Teleprompter overlay
7. Category presets per medium
8. Per-tool presence + independent views polish

V1.1 adds the AI layer (transcription, summaries, chapters) on top of these primitives.

---

Ready to write the file-by-file build plan and the first migration on approval.
