# Blog Post as a Context Object

Turn every published post into two things at once: a calm editorial page to read, and a durable, structured record of the creative world it belongs to. No new taxonomy, no new tables, no migration — everything is derived from relationships the Blog already stores.

## What changes for a reader

**Before the story** — quiet editorial identity only:

```text
FILM & VIDEO
How We Shot a Short Film in Two Days
A short deck sentence.
By Michael Cygan · August 5, 2026
```

The category label is new here and links to the existing category page. The rich Work card that currently sits between the header and the article is removed from that position.

**After the story** — one unified "About this post" coda replacing today's scattered "Connected to" chip strip:

```text
Category      Film & Video
Mediums       Short film · Documentary

Works         [ cover ]  Jesus Christ Diva
                         Short film · Film & Video
                         A brief description.
                         Michael Cygan · Director        View Work →

People        (avatar) Jane Doe — Cinematographer
Collabs       Casting Chicago Performers →
Groups        (avatar) Chicago Filmmakers
Events        Open Mic at Murphy's — Chicago · Aug 11
```

Only groups with real content render. A post with nothing connected shows no section at all (category alone is not enough to justify it). Then: Share / Report → Workshop conversion module → More from the Blog, in that order.

## Waves

**Wave 1 — Data alignment (no UI).**
`works.subtype` already exists and is populated on most published Works, but the Blog's Work resolver doesn't select it. Add `subtype` to the Works query in `blog-entity-tags.server.ts` and to the optional `BlogWorkSummary` type. Backward compatible: old posts and Works without a subtype simply omit it.

**Wave 2 — Derived context model.**
New client-safe helper `src/lib/blog-post-context.ts` exporting `deriveBlogPostContext(post)` returning `{ editorialCategory, mediums, works, people, collabs, groups, events }`. Mediums come only from linked Work subtypes, deduplicated and title-cased — never inferred from prose. People deduplicate against the byline. No page component does ad-hoc relationship math; future surfaces reuse this one function.

**Wave 3 — Editorial header.**
Add the category label above the headline in `blog.$slug.tsx`, linking to `/blog/c/$category` using `getBlogCategory()` labels (never a raw slug). Keep headline, excerpt, multi-author byline with role labels, published date, and the existing "Updated" rule.

**Wave 4 — `BlogPostContext` component.**
New `src/components/blog-post-context.tsx` renders the whole coda as a colophon: a light label column, generous spacing, hairline separators, no nested cards, no pill soup. Works keep the rich card treatment (cover, title, category + subtype, excerpt, credits, View Work) moved down from its old position; People/Collabs/Groups/Events are lighter linked rows with avatars where they exist.

**Wave 5 — Wire the page, retire the fragments.**
`blog.$slug.tsx` drops `BlogWorkContext` and `BlogEntityTags` and renders `BlogPostContext` after the body, before Share/Report. `BlogWorkContext` is deleted (only the post page uses it); `BlogEntityTags` is kept — the editor still uses that family — and only removed from the article layout.

**Wave 6 — Graph and privacy unchanged.**
No change to tag storage, the publish-time public-visibility assertion, `publicOnly` resolution, or `invalidateEntityTagCaches`. Reverse discovery ("From the Blog" on Works, profiles, groups) keeps working exactly as today.

**Wave 7 — Mobile pass.**
Label-above-value stacking on small screens, full-width Work covers, tappable rows, graceful truncation, no horizontal overflow, responsive spacing rather than shrunken desktop UI.

**Wave 8 — Editor preview + SEO.**
Preview tab gains the category label and an "About this post" render from the tags already picked in the editor, so a writer sees that connections become visible context. The `BlogPosting` JSON-LD `mentions` array is rebuilt from the same derived context so UI and schema describe identical relationships — same node count, no duplication, canonical/author/dates untouched.

## Technical notes

- Files touched: `src/lib/blog-entity-tags.server.ts` (add `subtype`), `src/lib/blog-entity-tags.ts` (type), new `src/lib/blog-post-context.ts`, new `src/components/blog-post-context.tsx`, `src/routes/blog.$slug.tsx`, `src/components/blog-editor.tsx`; delete `src/components/blog-work-context.tsx`.
- No database migration. `works.subtype` and `blog_posts.category_slug` already exist.
- Subtype labels display verbatim from `works.subtype` (free-form, already matching `CANONICAL_SUBTYPES` in `src/lib/taxonomy.ts`); no second subtype vocabulary is introduced.
- Unit tests for `deriveBlogPostContext`: dedupe of identical subtypes, author-vs-tagged-profile dedupe, empty-group suppression, and whole-section suppression.
