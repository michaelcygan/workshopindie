## 1. Artist statement

**Data**
- Add `artist_statement text` to `profiles` (nullable, max ~1000 chars enforced client-side).

**Edit UI (`src/routes/me.edit.tsx`)**
- In the existing "Mediums & bio" section, add a new `Textarea` labeled **"Artist statement"** with subtitle _"A short manifesto that sits above your Works. Leave blank to hide."_
- 4 rows, 1000-char counter, same styling as Bio.
- Wire into the existing `form` state and the profile update mutation — no new save button.

**Display (`src/routes/u.$username.tsx`)**
- Above the Works tab content (i.e. inside the Works panel, before the pinned-work / medium-filter row), render the statement as a pull quote:
  - `font-display`, larger italic-adjacent treatment on `ink-soft`, max-w-3xl, subtle left border accent.
- Render **only when non-empty** — no "no artist statement" empty state, no owner nudge, no placeholder chrome. Profile looks identical to today when blank.
- Include the statement in the profile `select(...)` query.

## 2. Cover image — "Upload or Select from Work"

**Edit UI (`src/routes/me.edit.tsx`, Identity section)**
Replace the raw `<ImageUpload …aspect="wide"/>` block with a new component `CoverImagePicker` that renders:

- Current cover preview (16:6) with two states: existing image or empty gradient placeholder.
- A single **"Change cover ▾"** button that opens a small dropdown (Radix `DropdownMenu`) with two options:
  1. **Upload image** — opens the existing `ImageUpload` file picker flow (hidden trigger; same bucket `covers`, same aspect `wide`).
  2. **Select from a Work** — opens a modal/sheet listing the user's own published Works that have a `cover_url` (query already exists at line 105 of me.edit.tsx: `id,title,slug,category,cover_url,published_at`). Filter to landscape-friendly covers by simply showing all Works with a cover; user picks one, and its `cover_url` becomes `form.cover`.
- A "Remove" ghost link when a cover exists.

Selecting from a Work just copies the URL into `form.cover` — no re-upload, no duplication. Saving flows through the existing update path (`cover_url: form.cover`).

**Work picker sheet**
- Reuse `Dialog` (already used elsewhere) with a grid of Work thumbnails (thumbnail + title). Empty state: "Publish a Work with a cover first to use this."
- Click a Work → sets `form.cover` and closes the sheet.

**No changes** to `u.$username.tsx` cover rendering — it already just reads `profile.cover_url`.

## Out of scope
- No changes to Works schema, credits, or public gallery.
- No auto-suggest of a Work cover — user opts in via the dropdown.
- No cropping/re-framing UI for chosen Work covers (the Work's own `cover_url` is already reasonably framed; wide crop happens via `object-cover` in the cover container).
