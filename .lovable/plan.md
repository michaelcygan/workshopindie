# Rename top-nav entry: "Start a Draft Workshop" → "Create a Workshop"

The screenshot is the top-nav create menu item (`src/components/top-nav.tsx:69`). The "Draft" status lives inside the create page itself and shouldn't bleed into the entry point — it dilutes the "Workshop" brand term.

## Change
- `src/components/top-nav.tsx:69` — `Start a Draft Workshop` → `Create a Workshop`. Icon (Coffee), link, and surrounding items unchanged.

## Out of scope (intentionally untouched)
The phrase "Draft Workshop" still appears in places where it describes the actual draft state, which is correct there:
- `src/routes/workshops.lobby.new.tsx` — page H1 + `<head>` title/description (the create page itself, where draft status is explained)
- `src/routes/workshops.$slug.tsx:717` — in-room banner ("This is a Draft Workshop")
- `src/components/lobbies-section.tsx:90` — "Draft Workshops" rail header (lists drafts specifically)
- `src/lib/lobby.functions.ts` — code comment

If you also want the create page H1 and the rail header renamed, say so and I'll extend the patch.
