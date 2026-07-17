## Goal
Typing `www.google.com` (or `google.com`) into any link field auto-normalizes to `https://google.com/` so extractors, validators, and saved records all get a proper URL.

## Approach
Extract the existing `tryNormalize` logic from `src/lib/moderation/url-blocklist.ts` into a shared helper and apply it on blur/submit across every URL input, starting with Post to Gallery.

### 1. New shared helper — `src/lib/url-normalize.ts`
- Export `normalizeUrl(raw: string): string | null` — trims, strips trailing punctuation, prepends `https://` if no scheme, validates via `URL`, requires a `.` in the hostname. Same logic as the existing `tryNormalize`.
- Export a small `normalizeUrlOrKeep(raw)` convenience that returns the normalized value if valid, otherwise the trimmed original (used for onBlur so we never silently blank the field).
- Update `src/lib/moderation/url-blocklist.ts` to re-use the shared helper (no behavior change to the moderation/Links tab pipeline).

### 2. Post to Gallery (`src/routes/works.new.tsx`)
- On the main "Paste a link" input:
  - onBlur → set input to `normalizeUrlOrKeep(value)` so the user visibly sees `https://…`.
  - On submit (`runExtract`) — replace the inline `url.startsWith("http") ? … : https://${url}` with `normalizeUrl(url)`; reject with a friendly toast if it returns null.
- Same normalize-on-blur for the Source URL field (line ~499).

### 3. Site-wide URL inputs (blur-normalize)
Apply the same onBlur normalization (no other logic changes) to every `type="url"` input already identified:
- `src/components/book-details-section.tsx` (buy links, sample chapter)
- `src/components/publish-from-collab-sheet.tsx` (primary URL)
- `src/components/post-workshop-from-city-sheet.tsx` (call URL)
- `src/components/workshop-drive-panel.tsx`, `src/components/workshop-tools-panel.tsx`, `src/components/workshop-player-tool.tsx`
- `src/routes/workshops.$slug.tsx` (primary URL, external call URL)
- `src/routes/workshops.$slug.tools.$tool.tsx`
- `src/routes/me.edit.tsx` (profile link)
- `src/routes/collab.new.tsx` (contact URL)
- `src/components/admin-import-event-dialog.tsx`

### 4. Validation sites that call `new URL(...)`
In `works.new.tsx` buy-links / excerpt validation (lines ~168–171), normalize before validating so a bare domain passes.

## Out of scope
- Chat/messages URL rendering — already handled by `extractUrls` + linkifier.
- Changing what "valid URL" means (still requires a dot in the hostname).
- Any UI redesign of the inputs.
