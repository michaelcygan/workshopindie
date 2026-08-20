# Compact the blog composer

The composer is correct but tall: every metadata field owns a full-width row, so on desktop most of the screen is empty gutter and the writing area sits far below the fold. This tightens the layout without removing a single field or changing how posts save.

## What changes

**1. "About this post" panel — the biggest offender**

Today it renders one labelled row per item: Post type, Field, Topics, Works, People, Collabs, Groups, Events — eight stacked rows, each mostly empty.

- The five connection rows (Works, People, Collabs, Groups, Events) merge into a single **Connections** row: one chip list holding everything with a small kind icon per chip, and one "Add a connection" button that opens the existing picker with a kind selector. Ordering, removal, and the 8-connection cap all behave as they do now.
- Remaining rows (Post type, Field, Topics, Specialization) sit in a **two-column grid on desktop**, single column on mobile.
- Row padding tightens, and the label column narrows.
- The whole panel collapses to a one-line summary once it has values — e.g. "Essay · Film & Video · 2 topics · 3 connections" with an "Edit" toggle. It starts open on a new post and collapsed on an existing one.

Net effect: roughly a full screen of height removed on desktop.

**2. Member composer (`/me/blog/$id`)**

- Keeps its Edit / Preview / Details tabs.
- On large screens the page widens from a single 3xl column to a two-column layout: the editor on the left, and a sticky right rail holding cover image + the collapsed About panel. The body editor gets the vertical space instead.
- Below `lg` nothing changes structurally — it stays the current stacked, tabbed flow, just with the shorter About panel and tighter spacing.

**3. Admin composer (`/admin/blog/...`)**

- Slug, Profile link, Author, and the Attributed profiles panel move into one collapsible **Byline & URL** section (collapsed by default, opens automatically if anything in it is set).
- Excerpt and Cover image sit side by side on desktop instead of stacked.
- The existing right rail (Search preview, Social card, SEO overrides) becomes an accordion so only Search preview is open by default.

## Technical notes

- Work is presentational: `src/components/blog-about-editor.tsx` (row grid, merged Connections row, collapse summary), `src/routes/me.blog.$id.tsx` (lg two-column shell), `src/components/blog-editor.tsx` (Byline & URL group, excerpt/cover pairing, sidebar accordion).
- No change to state shape, server functions, taxonomy payloads, entity-tag limits, autosave, or the publish flow. `BlogEntityTagPicker` is reused as-is with its existing `kind` filtering.
- Collapse state is local UI state only, using the existing shadcn Collapsible/Accordion primitives and semantic tokens.
- Mobile keeps the current single-column tabbed flow; only density and the About panel shrink.
