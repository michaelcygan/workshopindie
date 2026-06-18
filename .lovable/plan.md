# Replace "spin up" with "Start a Workshop" copy

Brand language: live rooms are **Workshops**. Swap the lingering "spin up [a] room" phrasing everywhere it refers to creating a Workshop.

## Edits

1. **`src/routes/workshop.index.tsx:509`** (the button in the screenshot)
   - `hostLabel ? \`Spin up ${hostLabel}\` : "Spin up your room"` → `hostLabel ? \`Start a ${hostLabel} Workshop\` : "Start a Workshop"`

2. **`src/routes/workshop.index.tsx:430`** ("be first" nudge)
   - `Be first — spin up a {label} room.` → `Be first — start a {label} Workshop.`

3. **`src/components/host-menu.tsx:482`** (end-workshop confirmation)
   - `You can always spin up a new one.` → `You can always start a new Workshop.`

4. **`src/routes/collab.new.tsx:535`** (Workshop card body)
   - `Spin up a live Workshop the moment you post…` → `Start a live Workshop the moment you post…`

5. **`src/routes/workshops.lobby.new.tsx:26`** (meta description)
   - `Spin up a private Draft Workshop…` → `Start a private Draft Workshop…`

6. **`src/lib/instant.functions.ts:94`** (code comment, for consistency)
   - `Spin up a brand-new live Workshop room…` → `Start a brand-new live Workshop…`

## Intentionally left alone

- **`src/components/workshop-tools-panel.tsx:183`** — "Spin up a shared tool" refers to creating a Doc/Board/Pinboard tool inside a Workshop, not creating a Workshop itself. Different concept, keep as-is unless you want it changed too.

No layout, icon, or component-structure changes — copy-only pass.
