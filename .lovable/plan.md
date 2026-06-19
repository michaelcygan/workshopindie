# Workshop 2027 Polish — Header, Dock, Tools, Drive, Nudges

Six scoped changes. All UI/presentation except item 5 (small data shape add for Drive link icons). No DB migration required.

---

## 1. "Create a Collab" reminder (2-min nudge)

New component `src/components/create-collab-nudge.tsx`, mounted in `workshop.$id.tsx` next to `BecomeHostNudge`.

- Fires once per room session at **120s dwell** (single `setTimeout`, cleared on unmount).
- Conditions: not promoted, viewer is host OR room is leaderless, ≥1 message OR ≥2 attendees (room actually has signal — avoid nagging dead rooms), not previously dismissed (`localStorage` key `cc-nudge:{roomId}`).
- UI: small floating glass pill anchored bottom-right above mobile nav, motion fade-up, copy: **"Worth making this a Collab? Lock it in so people can find it later."** Two actions: `Create a Collab` (opens existing `CreateCollabSheet`) and a soft `×` dismiss.
- Auto-hides after 25s if no interaction.

## 2. Header de-duplication + icon-per-medium

Edit `src/routes/workshop.$id.tsx` (lines ~277–315):

- **Drop the redundant `<h1>Workshop</h1>`** when the room title equals the FALLBACK_TITLE on desktop (md+). Keep the meta row (Live · count · Hosting/Claim · License). On mobile, keep a compact title for context.
- When the room has a real custom name (after a purpose pick or rename), the H1 stays — that's the actual content title, not redundant.
- Remove the back-link "← Workshop" on desktop (the top nav already shows Workshop as the active tab); keep it on mobile.
- **Medium icon**: replace hardcoded `<Coffee />` with a `mediumIcon(medium)` helper in a new tiny module `src/lib/medium-icons.ts` returning lucide icons per medium/category: film → `Clapperboard`, music → `Music`, writing → `PenLine`, build → `Wrench`, visual → `Palette`, critique → `MessagesSquare`, business → `Briefcase`, coworking → `Coffee` (default). Use across header, ChannelView empty-state aurora, and workshop cards (header only in this change).

## 3. Side dock redesign (2027 elegance)

Edit the right rail in `src/routes/workshop.$id.tsx` / wherever the dock JSX lives (the WORKSHOP / Chat·Tools·Work·Collabs · Mute / Camera off / New / Exit / "IN THE WORKSHOP" card visible in the screenshot — locate via `rg "IN THE WORKSHOP"`).

- One glass card (`bg-surface/60 backdrop-blur-md border-border/60 rounded-3xl`) replacing the current stacked blocks.
- Header row: subtle live-dot + "Workshop · 1/5" small-caps, no big "WORKSHOP" all-caps title.
- Tab row → segmented control: pill background with sliding indicator (framer-motion layoutId), 4 tabs Chat/Tools/Work/Collabs, tighter padding, single-row.
- Action grid: Mute / Camera as **icon-first chips** (smaller, equal-weight, not orange-filled by default; orange only when actively recording/muted as a status). New / Exit move into a smaller secondary row with ghost styling. Exit becomes a danger-ghost (red text only, no border).
- Attendees: switch "IN THE WORKSHOP · 1" to a dotted-row "Here now · 1" with stacked avatars + overflow chip, hover reveals names; click expands the full list inline.
- Add small "⚙︎ Customize" affordance opening the Settings link from item 7 below.

## 4. Empty/welcome state polish + "turn off in Settings"

`channel-view.tsx` EmptyLaunchpad:

- Increase aurora subtlety (reduce conic-gradient opacity, slow rotation to 60s), tighten purpose-tile typography (display font for title at `text-[15px]`, hint at `text-[11px]` muted).
- Add a small footer link below the starter chips: **"Quieter starts?  Turn this off in Settings →"** linking to `/settings#workshop`.
- New user pref: add to `src/routes/settings.tsx` a "Workshop · Welcome launchpad" toggle (default on). Stored on `profiles.show_workshop_launchpad` (boolean, default true) via a small migration — **OR**, to keep this change UI-only, store in `localStorage` key `pref:workshop-launchpad` keyed per user. Defaulting to **localStorage-only** to keep scope tight; can promote to DB later.
- ChannelView reads the pref; when off, renders a minimal "Quiet in Workshop." line + the starter chip row only (no purpose tiles, no aurora).

## 5. Docs → Drive consolidation + per-link object icons

- **Demote "Docs" tool** to a Drive provider type. Remove the `outline`/Docs chip from `TOOL_ORDER` in `workshop-tools-panel.tsx`. The existing `WorkshopDocsEditor` stays mounted only for legacy rows that already have `outline` enabled (read-only view + "Move to Drive" CTA, or just hidden behind a "Legacy doc" disclosure). No data loss.
- **Drive object-link icons**: extend `WorkshopDrivePanel` so each saved link picks an icon + label based on its provider + URL shape. Detection in a new helper `src/lib/drive-link-kinds.ts`:
  - `docs.google.com/document` → Google Doc (blue doc icon)
  - `docs.google.com/spreadsheets` → Sheet (green grid icon)
  - `docs.google.com/presentation` → Slides (orange play icon)
  - `drive.google.com/file` → Drive file (folder icon)
  - `figma.com/file|design` → Figma frame
  - `figma.com/board` → FigJam
  - `notion.so` → Notion page
  - `dropbox.com` → Dropbox file
  - `box.com` → Box file
  - `github.com/.../blob` → Code file; `/pull/` → PR; root → Repo
  - `youtube.com|youtu.be` → Video
  - `loom.com` → Loom
  - Fallback → generic Link icon
- Render: small colored circle + provider+kind label ("Google · Slides") on each link row; click still opens externally. Pure presentation — no schema change, all derived from `url`.

## 6. Tools audit — lean toward link-abstractions + browser-native realtime

Keep the **light** primitives; demote heavy/build tools.

**Keep (and polish):**
- **Screen Share** — already browser-native (getDisplayMedia).
- **Pop-out (PiP)** — Document PiP, already in.
- **Recording link** — pure link abstraction.
- **Player** — embed wrapper, link-driven.
- **Drive** — becomes the central link-abstraction surface (see #5).
- **List** — minimal real collab primitive, lightweight.
- **Board** — keep but mark **Beta** until v1.1; it's the heaviest realtime surface. Cap items, lazy-mount.

**Demote / hide at v1 (still readable if legacy data exists, but not in picker):**
- **Docs (outline)** → folded into Drive as a Google Doc link (item 5).
- **Pinboard** → already retired; remove leftover preset from picker.
- **Repo & Demo** → fold into Drive (GitHub link kind already detected).

**New light primitives (link-abstractions + browser realtime):**
- **"Shared Tab"** — paste any URL; everyone gets a 1-click open + a small "n viewing" badge driven by presence (no iframe, no proxy, just a shared "look at this" object). Stored as a Drive link with `kind:focus`.
- **"Timer"** — shared countdown for sprints/jams. Just `started_at + duration_seconds` in `instant_tools` config; everyone derives the same clock locally. No server tick. Add presets: 5/15/25/50.
- **"Hand-off"** — shared cursor/turn token: one person at a time holds the "mic" for screen narration. Pure presence-channel field, no media.
- **"Vote"** — quick thumbs/multi-choice on a Drive link, expires when host closes. Reuses `chat-polls` infra scoped to a link.

All four are <150 LOC each, no new tables — config lives in `instant_tools.config jsonb` + presence channel.

**Picker UX:** group tools into two strips — `Realtime` (Screen Share, PiP, Hand-off, Timer) and `Objects` (Drive, List, Board, Vote, Player, Recording). Drops the long single row.

---

## Out of scope (call out, save for later)
- Real Google Docs co-editing (would need OAuth + Drive API).
- Persisting launchpad pref to DB.
- Cross-medium icon rollout to workshop cards / index page (header only here).
- Migrating existing `outline` rows into `drive` rows (left as-is, read-only).

## Files touched
- **New**: `src/components/create-collab-nudge.tsx`, `src/lib/medium-icons.ts`, `src/lib/drive-link-kinds.ts`, `src/components/tools/timer-tool.tsx`, `src/components/tools/handoff-tool.tsx`, `src/components/tools/shared-tab-tool.tsx`, `src/components/tools/link-vote-tool.tsx`
- **Edited**: `src/routes/workshop.$id.tsx` (header + nudge mount + side dock), `src/components/channel-view.tsx` (dock + launchpad pref), `src/components/workshop-tools-panel.tsx` (picker reorg, demote Docs/Pinboard/Repo), `src/components/workshop-drive-panel.tsx` (per-link icon rendering), `src/routes/settings.tsx` (launchpad toggle)
