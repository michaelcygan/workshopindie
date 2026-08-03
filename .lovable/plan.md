## Goal

Tighten the member blog publishing flow (`/me/blog/:id`) so a post needs only a title, a body, and optional connections — everything else becomes optional or automatic — and publishing ends in a real "your post is live" moment. No schema, RLS, Plus-gate, quota, moderation, or public-route changes. Admin editor and public article page untouched.

## 1. Publish-success dialog

`publishMyBlogPostServer` already returns the full post row including the finalized slug, but `publishMut.onSuccess` throws it away and only toasts.

- Change `publishMut` to return the server post and open a new `BlogPublishSuccessDialog` with `{ slug, title, excerpt }` from that response (never the stale draft slug in local state).
- Suppress the intermediate "Saved" toast during a publish: `saveMut.mutateAsync` gets a `silent` flag so publish shows one confirmation only.
- New `src/components/blog-publish-success.tsx`: title "Your post is live.", description "It has a public Workshop link. Share it while it's fresh." Actions, stacked full-width on mobile: **Share post** (Web Share API, shown only when `navigator.share` exists), **Copy link** (with immediate "Copied" state), **View live** (`/blog/{finalSlug}`), and a close that returns to the editor. Warm/type-forward styling matching existing dialogs; rounded inset card with `pb-[env(safe-area-inset-bottom)]`; no confetti.
- Reuse the referral pattern from `share-sheet.tsx`: look up the author's username and append `?ref=username` when present.
- Extend `logShare`'s `entityType` enum in `src/lib/share.functions.ts` with `blog_post` (column is already `text`, no migration) and log `copy` / `native` channels.
- Cancelled native share leaves the dialog open and copies nothing.

## 2. Remove the URL slug field

- Delete the slug input, `slug` state, and `slug` from the save payload in `me.blog.$id.tsx`.
- No client-side slug generation. Server keeps `uniqueSlug(slugify(title))` at first publish, collision suffixes, and post-publish immutability (`updateMyBlogPostServer` still rejects slug changes for anyone who sends one).

## 3. Automatic excerpt

- New server helper `markdownToPlainText` + `generateExcerpt` in a plain module (`src/lib/blog-excerpt.ts`, importable by both server and preview): strips image syntax, `[[embed:…]]` markers, heading/list/quote markers, emphasis and code characters; keeps link labels and drops URLs; collapses whitespace; truncates near 180 chars on a word boundary with an ellipsis.
- In `publishMyBlogPostServer`, when `excerpt` is blank, compute it from the body, include it in the `moderateFields` call, and persist it in the same update that finalizes slug/author. A supplied excerpt is preserved verbatim.
- Editor: move the excerpt control out of Edit into the renamed **Details** tab as "Preview text (optional)" with helper "Generated from the opening of your post when you publish."
- Preview tab shows `excerpt || generateExcerpt(body)` so authors see the effective text before publishing.

## 4. Cover image description no longer required

- Remove the `cover_image_alt` publish guard in `publishMyBlogPostServer`; column stays nullable.
- Where alt is needed for rendering, fall back to the post title (Preview already does this; verify nothing else asserts alt).
- Move the field into Details as "Image description (optional)" with helper "Used by screen readers; the post title is used if left blank."
- When `ImageUpload` returns a different (or null) cover URL, clear `coverAlt` so stale metadata isn't carried to a new image.

## 5. Inline @ tagging that creates real connections

- `BlogBodyEditor`: label the AtSign toolbar button "@ Tag" (icon + text) so it reads clearly on mobile.
- Add a lightweight trigger: when the user types `@` at the start of a line or after whitespace (never inside an email — preceded by a word character disqualifies it), fire `onRequestEntityInsert` with an insert function pinned to that cursor position; the `@` is replaced by the inserted markdown.
- In `me.blog.$id.tsx`, the picker's `onPick` for the inline path now does both: insert `entityMarkdown(tag)` **and** append the tag to `entityTags` when not already present (respecting `MAX_BLOG_ENTITY_TAGS` — at cap it still inserts the link and shows a quiet note), set dirty, and keep the existing cache invalidation on save.
- Helper copy under the body: "Use @ to tag a person, Work, Collab, Group, or Event."

## 6. Mobile polish (no redesign)

- Action row: flex with wrapping removed in favour of a stable layout — back link on one line; actions right-aligned with `Save` + (`Publish` | `View live`) as ≥44px touch targets, and `Unpublish` (plus `Delete draft` where applicable) moved into a small overflow `DropdownMenu` after publication. No horizontal clipping at 375/390px.
- All remaining text inputs/textareas and the picker's search input bumped to `text-[16px]` on mobile to stop Safari zoom.
- Title input: `maxLength={160}` with a counter that only appears past ~140 characters.
- Hide the mobile island on the editor: `use-mobile-island-visibility.ts` already hides the composer for `/me/blog/:id`; extend `pathHidesIsland` with the same pattern so the whole island is hidden while writing.
- Desktop layout and the warm editorial styling are preserved; no new cards.

## Edit tab after this pass

Title → Cover image → Connections → Body. Everything else lives in Details.

## Technical notes

- Files changed: `src/routes/me.blog.$id.tsx`, `src/lib/blog-member.server.ts`, `src/components/blog-body-editor.tsx`, `src/components/blog-entity-tag-picker.tsx` (input sizing only), `src/lib/share.functions.ts`, `src/components/mobile-island/use-mobile-island-visibility.ts`, new `src/components/blog-publish-success.tsx`, new `src/lib/blog-excerpt.ts`.
- `blog-member.functions.ts` keeps accepting `slug` in its validator (admin/back-compat); the member UI just stops sending it.
- Verification: typecheck + lint, then Playwright passes at 390px and 1280px covering publish → dialog, Details tab, and the @ picker.
