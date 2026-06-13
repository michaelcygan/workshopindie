## Recorder Studio — flexible capture for Workshop rooms

The current Recorder is a one-button `getDisplayMedia` capture with the local mic mixed in. We're replacing it with a small in-browser studio: pick any combination of sources (cameras, mics, line-in/USB-C interfaces, screen, remote participants), choose a layout, hit record, and walk away with both a single mixed `.webm` and per-source raw `.webm` files saved to Drive.

All capture stays in the recorder's browser (no server transcoding), which is what makes pro audio interfaces and "guitar plugged into Scarlett" Just Work — they show up as standard `audioinput` devices.

## What you'll see in the UI

A compact 2027-leaning panel: dark surface, mono-spaced labels, hairline dividers, big level meters. Three stacked sections inside one card:

1. **Sources** — checkbox list grouped by kind:
   - Cameras (enumerated via `enumerateDevices`, plus "My room camera" which reuses the live stream so the device isn't double-opened)
   - Microphones / line inputs (every `audioinput` — USB interfaces, guitar DI, USB-C mics, virtual cables all appear here). Each row has a live VU meter so you can confirm signal before hitting record.
   - Screen / window / tab (triggers `getDisplayMedia` on enable; supports system audio when the browser allows it)
   - Remote participants (one row per peer currently in the room; toggles capture their cam + mic streams)
2. **Layout** (only relevant when 2+ video sources are active):
   - Auto grid
   - Spotlight + thumbnail strip (pick which source is the spotlight)
   - Single source (picker)
3. **Output** — read-only summary: "Mixed take + N raw tracks → Drive". Quality dropdown (720p / 1080p, bitrate auto). Big record button with elapsed timer and per-track recording dots.

After stopping: a results list with each file (mixed first, then one row per source), inline `<video>` preview on click, Download + "Open in Drive" links. Existing consent dialog for other room members stays.

## Output model

For every take we produce:

- `mixed-{timestamp}.webm` — single composited video (canvas) + mixed audio (Web Audio destination). This is the "share with the team" file.
- `cam-{label}-{timestamp}.webm`, `screen-{timestamp}.webm`, `mic-{label}-{timestamp}.webm` (audio-only `.webm` for line inputs) — one `MediaRecorder` per source, raw, for editing.

All files upload to the existing `instant-drive` bucket and get an `instant_drive_files` row. We add one new column, `take_id uuid` (nullable), so the Drive UI can group the files from the same recording together. Migration is a single `ALTER TABLE … ADD COLUMN`; no policy changes (existing RLS still applies).

For persistent (non-instant) workshops we mirror the same to `workshop_drive_files` with the same `take_id`. Until those rows exist, persistent rooms still fall back to local download (same as today).

## How the mix is built

- **Video mix**: an offscreen `<canvas>` running at 24fps. Each frame draws the selected video sources according to the chosen layout (grid math, or spotlight + thumb strip). `canvas.captureStream(24)` becomes the mixed video track.
- **Audio mix**: a single `AudioContext` with a `MediaStreamAudioDestinationNode`. Every selected audio source (local mic, each extra `audioinput`, screen audio, each remote peer's audio) gets a `MediaStreamSource` → gain node → destination. The destination's track is the mixed audio track.
- The mixed `MediaRecorder` runs on `new MediaStream([canvasTrack, audioDestTrack])`.
- The split recorders each run on a single-source `MediaStream` clone — independent of the mix.

## MIDI / instruments

We're treating "MIDI instrument" as **its audio output**, not note data. A user plugs their synth/guitar into an audio interface; the interface shows up in the Microphones list; they tick it; it gets its own raw track + lands in the mix. No Web MIDI dependency, no `.mid` files. This matches how DAWs treat external instruments and avoids a whole second capture pipeline.

## Browser & device caveats (surfaced inline in the UI)

- Recording remote participants only captures the audio/video tracks they're already sending to us via WebRTC — quality is bounded by the room call.
- Screen + system audio: Chrome/Edge only, and only for tab/window share with audio checkbox.
- Safari does not support `MediaRecorder` for `video/webm` with multiple tracks reliably — Safari users see a "Mixed take unavailable, split tracks only" notice.
- Per-track recorders share the device permission grant; we open each device exactly once and clone its track for both the mix and its split recorder.

## File changes

- `src/components/workshop-recorder.tsx` — rewrite. Splits into:
  - `recorder-studio.tsx` (the UI shell + state machine)
  - `recorder-engine.ts` (canvas compositor, audio graph, MediaRecorder orchestration, upload)
  - `recorder-source-row.tsx` (single device row with VU meter)
- `src/components/workshop-tools-panel.tsx` — already wires `media` into the recorder; no behaviour change, just renders the new component.
- `supabase/migrations/<ts>_drive_take_id.sql` — `ALTER TABLE public.instant_drive_files ADD COLUMN take_id uuid;` and same for `workshop_drive_files`. Index on `(room_id, take_id)` / `(workshop_id, take_id)`.
- `src/components/workshop-drive-panel.tsx` — minor: when files share a `take_id`, render them as a collapsible group titled "Take · {time}".

## Out of scope for this pass

- Per-participant **opt-out** that actually drops their tracks from the recording (today they just mute themselves — same as current behaviour).
- Cloud-side transcoding to MP4 (we hand back `.webm`; Drive already accepts it).
- Web MIDI `.mid` capture (explicitly skipped per your answer).
- Mobile Safari recording (unsupported by the browser).

## Verify

1. Open an instant Workshop room. Open Recorder.
2. Tick "My room camera", default mic, "Screen", and one remote peer. Pick Spotlight layout, spotlight = Screen.
3. Confirm VU meters move when you talk and when the peer talks.
4. Plug in (or fake with a virtual cable) a second audio input — it appears in the list, tick it, see its meter.
5. Record 20s. Stop. Confirm Drive shows one grouped take with: mixed file (plays back as spotlight + thumb composition, all audio audible), plus one raw file per ticked source.
