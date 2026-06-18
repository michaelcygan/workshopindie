# Workshop UI + Recorder simplification

Four scoped changes. All frontend except (1) a tiny tour-count column on profiles, (2) replacing `recorder` tool body with a `recording_link` body that stores a URL in `workshop_tools.config` / `instant_tools.config`.

---

## 1. Tools picker — reorder + consolidate

**File:** `src/components/workshop-tools-panel.tsx`

- `TOOL_ORDER` becomes: `["screen_share", "recorder", "outline", "board", "list", "drive", "player", "repo_links"]` — Screen Share first, Recorder second, then collaboration surfaces, then the niche ones.
- **Pinboard merge into Board:**
  - Remove `pinboard` from `TOOL_ORDER` and from the `AddToolMenu`. Keep `PRESETS.pinboard` and `presetFor()` mapping so any existing Pinboard rows in the DB still render with their current `ToolItems` view — no data loss, no migration risk.
  - Update Board's blurb to: *"Shared whiteboard for images, text, links, and reference pins."*
  - Update the empty-state helper line (line 183) to drop "Pinboard" from the list.

## 2. Recorder → "Recording link" (v1 simplification)

The in-app multi-source recorder is too risky for v1. Replace its body with a small panel that holds **one approved external recording link** (host pastes a Zoom / Riverside / SquadCast / etc. URL; participants see a "Join recording" button).

- Keep the tool type id `recorder` (no schema churn, no broken existing rows). Rename the label to **"Recording"** and the blurb to *"Drop in your Zoom, Riverside, or SquadCast link — everyone joins from here."*
- Replace `ActiveToolBody`'s `recorder` branch (currently renders `PersonaRecorderTabs`) with a new `<RecordingLinkPanel scope={...} toolId={tool.id} />`.
- New file `src/components/workshop-recording-link.tsx`:
  - Reads/writes `config.url` on the `workshop_tools` / `instant_tools` row (json column already exists for tool config in this codebase — if not, fall back to a sibling `workshop_tool_items` / `instant_tool_items` row with `url`).
  - Host can set/replace/clear the link. Everyone sees a big "Join recording on **Zoom**" button + the bare URL.
  - URL validation: only accept hosts in an allowlist:
    ```
    zoom.us, zoom.com, riverside.fm, squadcast.fm, descript.com,
    streamyard.com, restream.io, cleanfeed.net, loom.com,
    meet.google.com, teams.microsoft.com, teams.live.com
    ```
    Reject everything else with a toast naming the supported platforms. Detected platform name + favicon drives the button label/icon.
- **Leave the existing recorder engine code on disk** (`src/components/workshop-recorder.tsx`, `src/components/recorder/*`) — unimported, no runtime impact, available if we revive it. Add a one-line note at the top: *"v1: replaced by RecordingLinkPanel. Kept for future revival."*

## 3. First-run tour — repeat for first N workshops + dismissible

**Files:** `src/components/host-first-run-tour.tsx`, new migration, host-side workshop entry.

- Add column `profiles.host_tour_views int not null default 0` via migration (+ grant already covered by existing profiles grants).
- `HostFirstRunTour` currently runs once based on localStorage. Change gate to: show if `host_tour_views < 3` **and** not dismissed-this-session. On dismiss/complete, increment `host_tour_views`. After 3 workshops, never auto-show. Add a small "Show tour" link in the host menu so it's always re-openable.
- Pick **3** as the N (you mentioned 1/3/5/10 — 3 hits the sweet spot of "long enough to internalize, short enough to not nag"). Single constant `MAX_AUTO_TOUR_VIEWS = 3` so it's a one-line tweak later.

## 4. Seeded welcome message in chat

A single virtual system message rendered at the top of the chat scrollback — **not** a DB row, **not** a fake bot user. Always dismissible per-user via `localStorage` key `workshop-welcome-dismissed:<workshopId>`.

- New component `src/components/workshop-chat-welcome.tsx` rendered above the message list in the chat panel.
- Copy:
  > **Welcome to your Workshop.** This is your live room — talk shop, share screens, drop in tools, and riff on the work. Everything here is ephemeral until someone creates a Collab. Have fun.
- Styling: muted card with a small sparkle/wave icon, "Got it" dismiss button on the right. Doesn't scroll with messages — sits as a sticky header inside the chat panel until dismissed.

---

## Technical notes

- **No schema changes** for the recorder swap — reusing the existing tool row + a `config` field (verify it exists in `workshop_tools` / `instant_tools`; if not, the panel writes a single child item row with `kind='link'`).
- **One migration** for `profiles.host_tour_views` with the standard grant block.
- **Legacy Pinboard rows** keep rendering via the existing `presetFor()` fallback — no data migration, no backfill.
- **Recorder engine code is preserved** (dead-imported), so reviving the full multitrack flow later is a one-line re-wire in `ActiveToolBody`.
- Realtime concerns from the original ask become moot — the v1 recording-link panel has no media pipeline to fail mid-take.

## Out of scope (intentionally)

- Migrating existing Pinboard content into Board stickers (manual move only).
- Building the Podcast/Simple/Multitrack recorder modes — deferred until v1 ships and we have real usage signal.
- Server-side validation of the recording link allowlist (client-side is enough for v1; the field is host-only).
