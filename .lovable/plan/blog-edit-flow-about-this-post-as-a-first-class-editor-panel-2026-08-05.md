# Blog edit flow: "About this post" as a first-class editor panel (MVP v1)

Bring the post editor in line with the newly launched public post page. Today the editor has a generic
"Connections" box in the Edit tab and Category buried in the Details tab, while the public page shows a
single, structured "About this post" colophon (Category → Mediums → Works → People → Collabs → Groups →
Events). The editor should author exactly that object — and let an owner create a missing Work without
leaving the post.

## What changes for you

1. **One "About this post" panel** in the Edit tab, laid out in the same order as the live page. Category
   selection moves into it (out of Details), so the thing you edit looks like the thing readers see.
2. **Live Mediums line.** Once you connect a Work, the panel shows the formats derived from that Work's
   subtype, exactly as the public page will render them. Empty state explains: "Mediums come from the Works
   you connect."
3. **Add context by row.** Each row (Works, People, Collabs, Groups, Events) has its own "Add" affordance
   that opens the picker pre-filtered to that kind — no more one generic "add another connection".
4. **Create a Work inline.** In the picker's Works tab: "Can't find it? Create a Work." Opens a compact
   sheet — title, category, format/subtype, optional link, rights checkbox — publishes the Work, and
   connects it to the post in one step. A "Open Work to add cover and details" link goes to the full editor.
5. **Your own unpublished Works are pickable.** Today the picker only lists published + public Works, so a
   draft Work of yours is invisible. Owners will also see their own Works regardless of status, labelled.
6. **Owner-only.** The panel is read-only when the existing `access.canEditExisting` gate says so; the
   create-Work action requires being signed in and respects the free published-work cap (shows the same
   Plus gate as `/works/new`).
7. **Preview parity.** The Preview tab renders the real public `BlogPostContext` component (admin editor
   already does this; the member editor at `/me/blog/$id` gets it too).

## Scope calls for v1

- No new free-text "context note" field and no manual medium chips — mediums stay derived from Work
  subtypes so the graph stays true. "Manual context" here means you choose the connections and category by
  hand.
- Quick-created Works publish immediately (same as `/works/new`), so they are legitimately linkable.
- Reciprocal display on Work/Group/Event pages is unchanged; it already keys off the same tags.

## Technical notes

- **New component** `src/components/blog-about-editor.tsx`: authoring twin of
  `src/components/blog-post-context.tsx`. Props: `categorySlug`, `tags`, `readOnly`, `onChangeCategory`,
  `onChangeTags`. Internally calls `deriveBlogPostContext` (from `src/lib/blog-post-context.ts`) so editor
  and public page share one derivation, and keeps the existing reorder/remove controls per row.
- **Retire** `src/components/blog-entity-tags-editor.tsx` once both editors use the new panel.
- **Picker** (`src/components/blog-entity-tag-picker.tsx`): add `subtype` to the Works select so Mediums
  render live; add an owner branch that also returns the signed-in user's own Works (`created_by = uid`,
  any status) with a "Draft"/"Unlisted" sublabel; add a `onRequestCreateWork` slot rendered in the Works
  group.
- **New** `src/components/quick-create-work-sheet.tsx` + `createQuickWork` in a new
  `src/lib/works-quick.functions.ts` (`createServerFn` + `requireSupabaseAuth`): inserts into `works`
  (title, category, categories, subtype, primary_url, `source_type: 'manual'`,
  `license_type: 'portfolio_credit_only'`, `ownership_certified_at`, status published, visibility public,
  `created_by = context.userId`) plus the self `work_credits` row, mirroring `src/routes/works.new.tsx`.
  Surfaces the `Free tier work limit reached` error as the Plus gate. Medium-group auto-linking is already
  handled by the `tg_works_medium_groups` trigger.
- **Wire-up**: `src/routes/me.blog.$id.tsx` (Edit tab panel replaces `BlogEntityTagsEditor`; remove the
  Category block from Details; Preview tab renders `BlogPostContext`) and
  `src/components/blog-editor.tsx` (same panel; drop the standalone category select). Save/publish paths,
  `MAX_BLOG_ENTITY_TAGS`, and `invalidateEntityTagCaches` stay as they are.
- **Tests**: extend `src/lib/blog-post-context.test.ts` for medium derivation from a freshly created Work;
  add a unit test for the quick-create input schema.

## Build order

1. Picker: subtype select, own-Works branch, create-Work slot.
2. `createQuickWork` server fn + quick-create sheet.
3. `BlogAboutEditor` panel.
4. Wire both editors, move Category, preview parity, delete the old editor component.
5. Tests + a browser pass on `/me/blog/$id`.
