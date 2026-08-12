# Floating Save + smart autosave for the blog composer

## 1. Floating Save (desktop only)

A small pill appears in the empty right-hand gutter (the circled area) whenever **neither** the top nor the bottom Save button is on screen — so it shows while you're deep in the body, and quietly disappears when a real Save button scrolls into view.

- Position: fixed, right side, vertically centered-ish (`right-6`, around 40% viewport height), only at `lg` and up. Mobile keeps the existing action island — no change.
- Contents: "Save" (or "Saving…"), plus the same disabled behavior as the header button (disabled when nothing has changed or the post is read-only).
- Visibility: an IntersectionObserver watches the top action row and the bottom action row. Visible when both are out of view. Fades in/out (150ms), respects reduced motion.
- Also shows a tiny status line under the button: "Unsaved changes" / "Saved 4:12 PM".

## 2. Autosave — how it behaves

Autosave is genuinely useful for a long draft and genuinely bad when it silently rewrites something already public. So:

**Drafts (never published, or currently unpublished): autosave ON.**
- Triggers 2.5 seconds after you stop typing, and at most once every 15 seconds.
- Only after you've actually made a change (never fires on load).
- Also flushes when you switch tabs (Edit → Preview/Details), when the window loses focus, and on page hide, so nothing is lost by navigating away.
- Never shows a success toast — only the quiet "Saving…" → "Saved 4:12 PM" status in the header, the floating pill, and the bottom row.

**Published posts: autosave OFF.**
- Edits to a live post stay explicit: you press Save (or Publish) to push them to readers. The status line reads "Unsaved changes" and a browser "leave site?" warning fires if you try to close with pending edits.
- A small note next to the Save button explains it: "Live post — changes save when you press Save."

**Safety rails (both modes)**
- Autosave is skipped while an upload is in progress or a composer dialog (image/gallery/embed/tag picker) is open, to avoid saving a half-built block.
- Autosave never runs when the editor is read-only or when the post can't be edited.
- If an autosave fails, it stops retrying on a loop: shows "Couldn't autosave — press Save" in the status line and re-arms on the next edit. Version-conflict errors ("changed in another window") pause autosave entirely until you reload, so we never fight a second tab.
- The existing conflict guard (`expected_updated_at`) is kept; after each autosave the editor adopts the fresh timestamp so consecutive autosaves don't trip it.

## 3. Technical notes

- `src/routes/me.blog.$id.tsx`: add `lastSavedAt`, `autosaveState` ('idle' | 'saving' | 'saved' | 'error' | 'paused'), and a debounced effect keyed on the serialized draft payload. Reuse the existing `saveMut` with `{ silent: true }`. Track the latest `updated_at` in a ref so the optimistic-concurrency check stays correct across repeated silent saves.
- New `src/components/blog/floating-save-dock.tsx`: renders the pill + status, driven by two sentinel refs passed from the route; `useSyncExternalStore`-free, plain IntersectionObserver in a small `useVisibleSentinels` hook.
- Add a `SaveStatus` line to `PostActions` so the header, bottom row, and floating pill all show one consistent state.
- `beforeunload` guard registered only when `dirty` and autosave is off (published) or an autosave failed.
- No database or server-function changes; the existing update endpoint already supports everything needed.
