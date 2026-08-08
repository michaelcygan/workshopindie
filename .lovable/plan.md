# Visual inline embeds in the blog composer

## Audit (current state, verified)

1. **Insertion** — `src/components/blog-body-editor.tsx` has an Embed toolbar button that opens a dialog, validates the URL with a local `normalizeUrl`, and splices the literal string `[[embed:URL]]` into the single `<textarea>` value, padding it with blank lines.
2. **Storage** — the composer owns one string (`body` in `src/components/blog-editor.tsx`, saved as `body_markdown`). The marker is plain text inside that string. No block table, no second representation.
3. **Preview** — the editor's Preview tab renders `<BlogPostBody markdown={body} />`.
4. **Published** — `src/routes/blog.$slug.tsx` renders the same `<BlogPostBody>`. `BlogPostBody` splits the markdown on full-line `[[embed:URL]]` markers and renders each through `<BlogEmbed>` (YouTube, Vimeo, direct mp4/webm, generic link card, "Unsupported embed" fallback).
5. **Smallest architecture** — keep one canonical string. Change only the composer's presentation: parse the body into an ordered list of segments (text / embed), render text segments as auto-growing textareas and embed segments as the real `BlogEmbed` card with Edit · Remove, and re-serialize to the same markdown on every change. Nothing about storage, preview, publishing, or the public renderer changes.

No editor framework is introduced. No migration is needed — the parser is the same rule `BlogPostBody` already uses, so existing posts render visually the moment they open.

## Waves

### Wave 1 — Shared segment parser
Extract the embed-splitting logic used by `BlogPostBody` into `src/lib/blog-body-segments.ts` (`parseSegments`, `serializeSegments`). `BlogPostBody` switches to it so composer and public renderer can never drift. Round-trip guarantee: parse → serialize returns byte-identical markdown for untouched content.

### Wave 2 — Segmented composer surface
Rewrite the inside of `BlogBodyEditor` as a stack of segments inside the existing bordered surface:
- text segments: auto-resizing textareas styled exactly like today's editor field, no visible per-segment chrome, so it still reads as one writing area;
- embed segments: the real `<BlogEmbed>` card, rendered non-interactively (pointer events off on the media itself so clicking selects rather than plays).

The component keeps the same props and still emits one markdown string via `onChange`. Track which text segment holds focus plus its caret so all existing toolbar actions, `⌘B/⌘I/⌘K`, and `@` tagging operate on the active segment and splice into the correct place in the full string.

### Wave 3 — Insert / Edit / Remove
- Embed inserts at the active caret: split the current text segment at the caret and drop the embed block between the halves, then focus the newly created text segment below.
- Each card carries a small always-visible `Edit · Remove` row in Workshop's muted button language (visible on touch, not hover-only).
- Edit reopens the same dialog pre-filled; Remove deletes the block and merges the surrounding text segments with clean paragraph spacing (no orphan markers, no blank-line pileup).
- Backspace at the start of the text segment directly below an embed removes that embed; Enter behavior inside text is unchanged.
- Always keep a trailing text segment so there is somewhere to type after a final embed.

### Wave 4 — Regression pass
Verify bold, italic, inline link, headings, quote, lists, `@` entity tagging, keyboard shortcuts, word count / reading time, dirty tracking and save, draft reload, Preview tab, and published rendering — all against a body with several embeds separated by long text.

### Wave 5 — Mobile and reliability
Check narrow viewports for width containment (no horizontal scroll), video aspect ratio, tappable Edit/Remove, keyboard-safe typing above and below a card, and the scrolling toolbar. Reliability cases: invalid URL (rejected in the dialog as today), unknown provider (generic link card), malformed legacy marker (left as literal text, never a crash), embed render failure (card falls back but the URL and its controls survive).

### Wave 6 — Polish
Spacing, borders, focus ring on the active segment, subtle loading state while a card mounts. Restrained; no scope growth.

## Explicitly out of scope
Block editor, slash commands, drag reordering, new providers, metadata/oEmbed fetching beyond what `BlogEmbed` does today, AI features, layout controls, and any change to `body_markdown` storage.

## Technical notes
- Files touched: `src/lib/blog-body-segments.ts` (new), `src/components/blog-body-editor.tsx`, `src/components/blog-post-body.tsx` (parser import only), possibly a small `src/components/blog/embed-card-shell.tsx` for the author controls wrapper.
- `blog-editor.tsx`, the save/publish functions, and `blog.$slug.tsx` are unchanged.
- Rich per-URL metadata (title/description/image) is not fetched today; the link card shows host + path. This plan keeps that and does not add a metadata service.
