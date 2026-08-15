# Blog taxonomy optimization

One coherent Blog classification model, end to end:

**Category → Post type → Field → Subject → linked Workshop entities** (no Material).

## What changes for people using the site

- Authors pick **one Post type** (Essay, Report, Tutorial, Interview, News, Process Note, Review, Journal) instead of up to three. The editorial **Category** is derived from that choice — nobody picks both.
- Categories are the five sections: **Essays** (Essay, Report, Review), **Interviews** (Interview), **Field Notes** (Process Note, Journal), **Resources** (Tutorial), **Announcements** (News).
- Authors can add up to **five Subjects** (free tags with suggestions), first one is the lead.
- **Field** stays optional, up to three, primary first, General stands alone. Specialization disappears from new authoring; existing data is untouched.
- Blog navigation drops the 13-Field rail for: All · Essays · Interviews · Field Notes · Resources · Announcements, plus compact filters for Post type, Field, and Subject with shareable URLs.
- Every Blog card and the article eyebrow read **POST TYPE · LEAD SUBJECT**, falling back to primary Field, then Post type alone.
- "About this post" shows Post type, Category, Fields, Subjects, then only the linked items that exist. The Medium row derived from linked Works is removed; connected Work cards read **WORK CATEGORY · PRIMARY FIELD**.

Existing posts keep working: old `/blog/c/<field>` links still resolve, untyped legacy posts stay visible and editable, and no legacy data is deleted.

## Technical plan

### Data
- Additive migration: `blog_posts.subjects text[] not null default '{}'` + GIN index. No existing migration is edited. `story_type`, `story_types`, `fields`, `category_slug`, `subcategories`, `publication_type` all remain.
- Post type resolution: `story_type` wins; else first valid entry in `story_types`. On an explicit Post type change, normalize both to the single new value; otherwise leave legacy `story_types` intact.
- `category_slug` stays a derived mirror of the primary Field for legacy routing only — never surfaced as Category.

### Shared modules (new / refactored)
- `src/lib/blog-story-types.ts`: add the five-Category registry, `blogCategoryForStoryType`, `storyTypesForCategory`, stable Category ids/slugs/labels, and a `resolvePostType(row)` helper.
- `src/lib/entity-tags.ts` (extracted from `src/lib/work-tags.ts`): entity-neutral `normalizeTags`; Blog gets `MAX_BLOG_SUBJECTS = 5` and its own suggestion list. Work keeps its current behavior via re-export.
- `src/components/entity/subject-tag-input.tsx`: entity-neutral suggestion + free-entry tag field, used by Blog (and available to Work).
- `src/lib/blog-form.ts`: shared client-safe hydration, validation, and write-payload builder for Post type / Fields / Subjects / entity tags / legacy values. Both `src/components/blog-editor.tsx` (admin) and `/me/blog/$id` use it; single Post type required to publish, drafts may be untyped.
- `src/lib/blog-select.ts`: centralized list/detail/editor select strings and row → card mappers so every surface reads the same taxonomy columns. Member `DASHBOARD_FIELDS` / `EDITOR_FIELDS` gain `story_types`, `subjects`.

### Server
- `blog.server.ts` and `blog-member.server.ts` accept and validate `story_type` (single), `story_types` (mirror), `fields`, `subjects`; derive `category_slug` from the primary Field. Autosave, optimistic concurrency, Plus gates, publish limits, cover-alt validation, moderation, and admin controls are preserved.
- New server-side Category listing filters `story_type`/`story_types` by the Post types mapped to that Category (no client-side full-collection filtering).
- Blog entity search / tag resolution select the Gallery classification columns (`category_id`, `category_canonical`, `categories_canonical`, `subjects`, legacy fallbacks) and reuse the Gallery resolver.

### UI
- `blog-about-editor.tsx`: rows ordered Post type (single-select) → Fields → Subjects → Works → People → Collabs → Groups → Events → Related posts. Removes Specialization, Format-from-Work, the connections counter, and "Add a connection" wording in favor of "Add a Work" / "Add a person" / "Linked items".
- `blog-post-context.ts(x)`: drop `mediums`; add `postType`, `category`, `subjects`; render taxonomy rows even with zero linked entities, hiding empty rows.
- New route `src/routes/blog.category.$category.tsx`; `blog.c.$category.tsx` untouched. `blog-category-nav.tsx` switches to the five Categories + All. Filter state (`type`, `field`, `subject`) lives in the URL search params.
- Cards everywhere (index, category, featured carousel, latest/more/archive, home rails, Member Home, profile Blog tab, related modules, "From the Blog" rails, peek, RSS) go through the shared eyebrow resolver.

### Structured data
`BlogPosting` gains `articleSection` from the derived Category and `keywords` from Subjects + Fields; relationship entities stay as `mentions`. Inherited entity metadata never becomes direct Blog keywords.

### Tests
New/updated unit tests covering: exhaustive Post type → single Category mapping; publish validation requires one Post type; legacy `story_types` hydration and preservation; Field normalization + `category_slug` compatibility; Subject trim/dedupe/order/limit; admin vs member payload parity; About-this-post with taxonomy and no entities; no Medium/Format derivation; connected Work eyebrow; legacy `/blog/c/*` resolution; server-side Category filtering; untyped legacy posts visible under All; linked entities never mutate direct Blog Fields/Subjects. Then typecheck, test run, and production build.
