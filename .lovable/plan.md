## What the audit found

Much of this feature already exists from earlier work, so this plan only closes the real gaps. Verified in source:

Already correct — do not rebuild:
- Connection replacement is transactional through the `replace_blog_post_entity_tags` database function, with owner/admin authorization checked server-side (`src/lib/blog-entity-tags.server.ts`).
- The member editor saves post fields and connections in one server call, and a connection failure already fails the whole save (`src/lib/blog-member.server.ts:326-333`, `src/routes/me.blog.$id.tsx:113-139`).
- Cache invalidation already uses the partial key `["entity-blog-posts", kind, entityId]` with no limit in the prefix (`src/lib/blog-entity-tags.ts:118`).
- Reciprocal eligibility is already authoritative: only the Work creator, credited collaborators (`work_credits.user_id`), or non-member editorial posts surface on a Work page (`blog-entity-tags.server.ts`, trusted filter).
- A featured Work context card already renders on blog articles before the body (`src/routes/blog.$slug.tsx:192`), and the Work page already renders connected stories with `EntityBlogPosts`, `EditorialCard`, `BlogPostPeek`, and a contributor-only "Write about this Work" action seeding a normal draft.

Confirmed gaps this plan fixes:
1. In the admin editor, `flushAuthors` catches its own error and resolves (`blog-editor.tsx:119-133`), and `onPublish` calls `onSave`, which swallows errors — so publishing can proceed after a failed save.
2. The admin save button always reads "Save draft", even on published posts.
3. The body toolbar action is labelled "Tag a Workshop item", which reads as connecting when it only inserts a Markdown link.
4. The entity picker selects `cover_url` for Works and Events but maps `image: null` (`blog-entity-tag-picker.tsx:72,96,154`), so covers never render in the connections list.
5. Connections sit below the long body editor in both editors.
6. The admin Blog table has no connection column or filter.
7. On the Work page the stories section sits after credits and "Also worked together", uses the heading "Stories about this Work", and its peek is local state with no URL backing.
8. Draft-seed failures are silently swallowed (`blog-member.server.ts:174`).

## Wave 1 — Make admin saving trustworthy

- Let `flushAuthors` throw (prefixed error) instead of toasting and resolving.
- Split `onSave` into a throwing `runSave()` plus a thin toast wrapper, so `onPublish` awaits `runSave()` and aborts publish on any failure — no success toast, dirty state preserved, selections intact, retry works without reselecting.
- Only clear dirty state after every step succeeds.
- Make `seedDraftTag` surface a real failure rather than silently dropping the seeded Work (draft creation still succeeds; the editor reports the connection wasn't attached).
- Label the admin primary button "Save changes" for existing posts and "Save draft" only for new/unpublished drafts. Saving connections on a published post continues to leave slug, `published_at`, and status untouched.

## Wave 2 — Elevate Connections in both editors

- Update `BlogEntityTagsEditor` copy: heading "Connections", helper "Connect this post to the Work, people, or places it is substantially about. Published posts may appear on those pages.", primary action "Connect a Work" (opens the existing picker on the Works tab), secondary "Add another connection". Ten-connection cap unchanged.
- Fix the picker's `image` mapping to use `cover_url` for Works and Events so covers render; keep truncation and comfortable tap targets.
- Show category and an "Open Work" affordance on selected Work rows alongside existing reorder/remove controls.
- Move the connections card above the body editor: directly before the body in `/me/blog/$id`; in the admin editor at the top of the right rail on desktop and before the body on mobile via grid ordering — one component, one state source.
- Rename the body-toolbar action to "Insert Workshop link" with dialog copy "Insert a link to a Work, Collab, Group, Event, or person inside your article." Distinct screen-reader labels for insert-link versus add-connection.

## Wave 3 — CMS connection visibility

- Extend the admin list query to attach a connection summary per post in the same request using one batched query over `blog_post_entity_tags` (no N+1).
- Add a Connections column rendering "1 Work", "2 Works · 1 Person", or "Unconnected"; on narrow layouts it appears under the title instead of widening the table.
- Add a single filter: All / Connected to a Work / Unconnected.
- Update visibility copy: "Hidden from the main Blog index. Published posts may still appear on author profiles and eligible connected pages."

## Wave 4 — Public reciprocal polish

- Move the Work page's stories section above credits, provenance, and comments — after the description, media, and source action.
- Heading "The story behind this Work", supporting line "Process, context, and notes from the people around it."
- Single-story case renders at an intentional width rather than one card in a three-column grid; two or three use the responsive grid. Nothing renders when empty and the viewer has no write affordance.
- Back the story peek with URL state `?story=post-slug` following the existing profile pattern: refresh preserves it, Back closes it, closing clears the param, modifier-click and "Open full article" still hit the canonical URL.
- Keep credit-derived role labels from `work_credits.role_label`; never infer a role from the byline.

## Verification

Typecheck, lint, tests, and production build after each wave. Manual passes with an authenticated preview session: add/remove a connection on an old draft and an old published member post and confirm persistence and unchanged slug/status; the same on an admin post; a forced connection failure showing no success and no publish; an unrelated member's tagged post appearing on their article but not on the Work page; responsive checks at 320/375/390/430px, tablet, and desktop.

### Technical notes

No schema changes, no new tables, no new RPCs — the existing `blog_post_entity_tags` table and `replace_blog_post_entity_tags` function already provide transactional replacement with correct authorization. Files touched: `src/components/blog-editor.tsx`, `src/routes/me.blog.$id.tsx`, `src/components/blog-entity-tags-editor.tsx`, `src/components/blog-entity-tag-picker.tsx`, `src/components/blog-body-editor.tsx`, `src/components/entity-blog-posts.tsx`, `src/routes/works.$slug.tsx`, `src/routes/admin.blog.index.tsx`, `src/lib/blog.server.ts`, `src/lib/blog-member.server.ts`.
