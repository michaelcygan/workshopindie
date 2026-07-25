## Import the Homestead Creative backlog

### 1. Add profile-linked authorship
- Extend `blog_posts` with an optional author profile reference suitable for future contributors.
- Keep `author_name` as the display-name fallback, while linking associated authors to their Workshop profile.
- Update admin create/edit flows so an author profile can be selected or cleared without disrupting name-only contributors.

### 2. Show clickable author attribution
- Render “By Michael Cygan” as a link to `/u/michaelcygan` on imported articles.
- Use person-based structured data with the Workshop profile URL for linked contributors; retain the existing organization fallback when no profile is attached.
- Include the author profile reference in public and admin blog queries.

### 3. Transform the export
- Select only the 111 published `post` items tagged `Creativity`.
- Convert Squarespace HTML into safe Markdown compatible with the existing shared renderer, preserving headings, paragraphs, lists, quotes, links, and images while removing Squarespace layout markup.
- Preserve all 111 unique legacy slugs and original publication dates from 2021–2025.
- Generate concise excerpts from article text because the export has no excerpt fields.
- Attribute every imported article to **Michael Cygan** and associate it with the confirmed `@michaelcygan` Workshop profile.
- Reuse the first meaningful article image as the cover where possible, with a conservative title-based alt fallback; preserve remaining inline images.

### 4. Publish and validate
- Insert the transformed posts directly as published records; the existing blog table is currently empty, so no slug collisions are expected.
- Verify the database count, status, date range, unique slugs, non-empty bodies, profile associations, and representative image URLs.
- Test the blog index and several article pages on desktop and mobile, including author navigation, Markdown rendering, SEO metadata, sitemap inclusion, and RSS output.

### Technical notes
- The schema change will be applied through a reviewed database migration with existing access rules preserved.
- The bulk content load will use the database data-import path, not a runtime/public import endpoint.
- The importer will be kept deterministic and idempotent by using the preserved slugs as stable identities.