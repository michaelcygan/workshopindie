# Blog composer: "Process note" + up to 3 types

## Changes

1. **Rename the type.** "Research note" becomes "Process note" everywhere it shows (composer chips, published post label). The stored id stays `research_note` so the 0 posts currently using it — and any future ones — keep working; only the label changes.

2. **Allow up to 3 types.** In the "About this post" section of the blog composer, Type becomes a multi-select capped at 3, matching how Fields already works (counter in the header, e.g. "2/3", chips toggle on/off, a 4th tap is refused with a short toast). The first one selected stays the post's primary type — that's what shows as the label on the published post page.

3. Type stays optional; a post with no type selected behaves exactly as today.

## Technical notes

- `src/lib/blog-story-types.ts`: change the `research_note` label to "Process note"; add a `BLOG_STORY_TYPE_MAX = 3` constant and a `toBlogStoryTypes()` normalizer (dedupe, drop unknowns, cap at 3).
- Migration: add `story_types text[] not null default '{}'` to `public.blog_posts`, backfill from the existing `story_type`, and keep `story_type` in sync as `story_types[1]` on write so the published-post label, SEO and any existing reads need no change.
- Server: extend the member (`blog-member.server.ts` / `.functions.ts`) and admin (`blog.server.ts` / `.functions.ts`) update payloads with an optional `story_types` array validated against the canonical ids and capped at 3; derive `story_type` from it server-side.
- UI: `blog-about-editor.tsx` Type row switches from a single-value chip group to array toggling with a `n/3` counter; `blog-editor.tsx` and `me.blog.$id.tsx` carry `storyTypes` state through save.
- Published post (`blog.$slug.tsx`) continues to render the primary type label — no visual change there.
