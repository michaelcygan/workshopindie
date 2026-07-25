# Blog posts in Lounge chat tagging

Extend the existing shared `@` typeahead used in Lounge chat so members can search any published blog post on the site and drop it in as a chip that opens in `BlogPostPeek` — matching how Collabs, Groups, Events, and Works already behave.

## Scope

- Lounge chat composer (`ChatMentionInput` + `MentionPopover`) gains a **Posts** section.
- Search covers every live post (`status=published`, `show_in_blog_index=true`, `published_at<=now`) across the site, not just posts by room participants.
- Rendered chip in messages links to `/blog/<slug>` and opens a `BlogPostPeek` on hover/click, preserving the Lounge session.
- No DB migrations. Uses the existing public read policy on `blog_posts`.

## Changes

### 1. New suggestion source
`src/lib/mention-suggestions.ts`
- Add `"post"` to `MentionKind`.
- Add `useBlogPostSuggestions(query, enabled)`:
  - Queries `blog_posts` via the browser `supabase` client (anon has SELECT on public posts).
  - `ilike("title", "%q%")`, filters status/published_at/show_in_blog_index, orders by `published_at desc`, capped at `LIMIT`.
  - Returns `{ kind: "post", id, label: title, sublabel: author_name, avatar: cover_image_url, insert: "[Title](/blog/<slug>) " }`.

### 2. Popover integration
`src/components/mention-popover.tsx`
- Accept `"post"` in `MentionPopoverSection`.
- Call `useBlogPostSuggestions` when included; append after Works.
- `KIND_LABEL.post = "Posts"`.
- Add `SuggestionIcon` branch for posts (cover image if present, else `FileText` in an ink-toned circle).

### 3. Composer wiring
`src/components/chat-mention-input.tsx`
- Add `"post"` to the `sections` list passed to `MentionPopover`.

Other consumers of `ChatMentionInput` (DMs, Today) pass sections through `MentionPopover` themselves and are unaffected unless they opt in later.

### 4. Chip rendering + peek
`src/components/chat-mention-input.tsx` (`MessageBody`)
- Add `postRe = /\[([^\]\n]{1,120})\]\(\/blog\/([a-zA-Z0-9_-]{1,120})\)/g` matched before the generic URL scans.
- New `"post"` segment renders a chip: `FileText` icon + label, styled like the existing chips (neutral ink token, matches the muted/serif blog voice — not reusing the coral/violet/primary tints already in use).
- Wrap the chip in a lightweight `BlogPostChip` (new tiny component in the same file or `src/components/blog-post-chip.tsx`) that:
  - On click, opens `BlogPostPeek` with the slug (managed via local `useState` inside the chip so each chip is self-contained).
  - No hover peek needed initially — click-to-open matches the peek modal's weight better than a hovercard for long articles.

## Technical notes

- No changes to `MessageBody` regex ordering rules beyond adding `postRe` before `collabRe`; the "already covered" guard prevents overlap.
- `useBlogPostSuggestions` uses the anon-scoped browser client so search works for all signed-in Lounge members without a new server function.
- The insert format `[Title](/blog/<slug>)` is stable with existing markdown link handling and will render as a plain link in any surface that hasn't yet added the post regex (safe fallback).
- No schema, RLS, or GRANT work needed — `blog_posts` already exposes the columns via the public read policy.

## Verification

- Type `@` then a post title fragment in Lounge chat → see the Posts section with cover thumbnail, author sublabel.
- Select a suggestion → chip appears in the composer; sending renders the chip in the message stream.
- Click the chip → `BlogPostPeek` opens without leaving the Lounge.
- `bunx tsgo --noEmit` clean.
