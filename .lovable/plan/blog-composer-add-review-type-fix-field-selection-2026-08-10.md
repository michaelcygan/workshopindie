# Blog composer: add "Review" type, fix Field selection

Two fixes in the "About this post" panel of the blog editor.

## 1. Add a Review story type

"Review" joins Essay, Report, Tutorial, Interview, News, Research note, Journal — for criticism and reviews. It appears in the composer chips and as the label readers see on the published post, everywhere the other types already do.

This requires a small database change: the story-type column currently only accepts the seven existing values and rejects anything else, so `review` has to be added to the allowed list before the button can save.

## 2. Fix "can't select a Field"

Confirmed bug, not a display issue. New posts start with the Field set to **General**. The Field picker handles that case by making two separate updates back-to-back — "set the new primary field", then "clear the extras". The second update is computed from the state as it was *before* the first one, so it overwrites the selection and the field snaps straight back to General. That is why tapping any field appears to do nothing, on mobile and desktop alike.

The same double-update also breaks the star button that promotes a secondary field to primary.

Fix: have the picker report the whole field list in one update instead of two, so nothing is computed from stale state. Selecting a field, swapping the primary, toggling extras on/off, and the General-is-exclusive rule all keep behaving as designed.

## Technical notes

- `src/lib/blog-story-types.ts` — add `{ id: "review", label: "Review" }`. `BLOG_STORY_TYPE_IDS`, the Zod enums in `blog.functions.ts` / `blog-member.functions.ts`, and `blogStoryTypeLabel` all derive from this list, so nothing else needs touching.
- Migration: drop and recreate `blog_posts_story_type_check` with `review` included.
- `src/components/field-picker.tsx` — add an optional atomic `onChange(fields: FieldId[])` callback; when supplied, `toggle()` and `promote()` emit one ordered array (primary first) instead of calling `onPrimaryChange` + `onExtrasChange` in sequence.
- `src/components/blog-about-editor.tsx` — pass `onChange={onChangeFields}` to `FieldPicker`.
- `src/routes/works.new.tsx`, `works.$slug.edit.tsx`, `collab.new.tsx` keep the existing two-callback shape (they hold primary and extras as separate state, so they are unaffected) — no changes there.

## Verification

- Load the composer, confirm the Field picker starts on General, tap "Film & Video" and confirm it sticks; add a second field and star it to swap the primary.
- Select "Review", save, reload the draft, and confirm it persists and renders on the published post.
