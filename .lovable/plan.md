## Where we are

Waves 1 and 2 are in: connection saves fail loudly instead of silently dropping, seeded "Write about this Work" drafts report a failed connection, and Connections is now a first-class block above the body in both editors.

Waves 3 and 4 remain.

## Wave 3 — Connections visible in the admin CMS

Today `adminListPostsServer` (src/lib/blog.server.ts:248) selects post columns only, and the admin table (src/routes/admin.blog.index.tsx) has no notion of connections — an editor cannot tell which posts carry context without opening each one.

- Extend `adminListPostsServer` to batch-fetch connection summaries for the listed posts in one round trip, using the existing `getBlogPostEntityTagsBulkServer` helper (already written for exactly this shape). Attach a compact `connections` array (kind, id, label) per post. One extra query for the page, not one per row.
- Add a **Connections** column to the admin table: the first two connection labels as small chips with kind icons, plus a "+N" overflow, and an em dash when a post has none.
- Add a **Connections** filter chip group alongside Type / Status / Visibility: All / Has connections / None. Also let the existing search box match connection labels, so searching a Work title finds the posts about it.
- Update the visibility copy so it states the actual rule: connections surface published posts on the connected pages; drafts stay private.

## Wave 4 — Public reciprocal context and polish

On the Work page (src/routes/works.$slug.tsx:315) the story rail currently sits below Credits and "Also worked together", and the peek modal holds the open post in local state only — so a reader cannot link anyone to the story they are reading.

- Move the story rail above the Credits block and rename the heading to **"The story behind this Work"**. Reading order becomes: work → description → story → credits → comments, which matches how the context is meant to be read.
- Back the story peek with URL state: add `validateSearch` for an optional `story` slug on `/works/$slug`, drive `EntityBlogPosts`'s peek from that search param, and push/replace it on open/close. Opening a story becomes shareable and back-button-friendly; closing restores the clean URL.
- Keep the empty state honest: for an owner or credited collaborator with no stories, the rail reads as an invitation with the "Write about this Work" action; for everyone else it stays hidden.
- Verify at 390px and desktop that the rail, chips, and peek behave, and that a shared `?story=` URL opens directly into the peek.

## Technical notes

No schema changes and no migrations. Edits are confined to `src/lib/blog.server.ts`, `src/routes/admin.blog.index.tsx`, `src/components/entity-blog-posts.tsx`, and `src/routes/works.$slug.tsx`. The `story` search param is optional, so existing Work URLs and their OG metadata are unaffected. Typecheck after each wave.
