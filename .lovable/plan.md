# Pop-Out Tool: Source Picker

Today the PiP tool panel has a single "Pop out" button. The popped-out window already supports Me / Speaker / Tool sources internally, but the user wants those choices surfaced in the panel itself so they can launch directly into the view they want, and add a couple of related options.

## Changes

### 1. `src/components/workshop-tools-panel.tsx` — `PipBody`
Replace the lone "Pop out" button with a small option grid. Each option is a launch button that opens PiP with a preselected source:

- **Me** — your camera tile
- **Active speaker** — auto-follows whoever is talking
- **Current tool** — whatever's in the main tool slot (screen share, board, player, etc.)
- **Director (when sharing)** — only shown when a screen share is active; launches the existing Director mode (Tool / Split / Cam cuts)

Each button dispatches `CustomEvent("workshop:pip-open", { detail: { source: "me" | "speaker" | "tool" | "director" } })` instead of the current detail-less event. Keep the browser-support detection and disabled state.

Add a small "Always on top" hint line under the grid noting it's a Chromium-only feature when unsupported.

### 2. `src/components/workshop-pip.tsx`
- `useWorkshopPip.open` accepts an optional `{ initialSource?: Source }` arg and threads it into `PipBody` via a new `initialSource` prop.
- `StandardPipBody` initializes `useState<Source>(initialSource ?? "me")`.
- Director branch already auto-triggers when `screenSharerId` is set; when `initialSource === "director"` and no one is sharing yet, fall back to "tool" with a small toast-style overlay ("Waiting for a screen share…").
- No change to the in-window source chips — they remain for switching after pop-out.

### 3. `src/components/channel-view.tsx`
Update the `workshop:pip-open` listener to read `e.detail?.source` and pass it through: `pip.open({ initialSource: e.detail?.source })`.

## Out of scope
- No new sources beyond Me / Speaker / Tool / Director (covers the asked-for set).
- No persistence of "last used source" — launch is always an explicit choice.
- No changes to the Director composer or canvas pipeline.
