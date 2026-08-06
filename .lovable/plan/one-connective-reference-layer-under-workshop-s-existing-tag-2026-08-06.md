# One connective reference layer under Workshop's existing tagging

A consolidation pass, not a new feature. Workshop already lets its primitives point at each other in
seven or eight places. Those places were written at different times and quietly disagree. This plan
gives them one shared spine — resolve once, search once, render once, enforce visibility once — while
each surface keeps its own meaning and its own UI.

## What the audit found

Confirmed by reading the current code, not assumed:

- **Two message parsers that disagree.** `src/lib/today-text.tsx` (Group Today) recognises Work links
  `[Label](/works/slug)` and renders a Work peek. `MessageBody` in `src/components/chat-mention-input.tsx`
  — used by **both DMs and Lounge chat** — has regexes for event/group/collab/post but **none for Works**.
  Meanwhile the shared `@` picker (`src/lib/mention-suggestions.ts`) happily inserts Work links. So a Work
  mentioned in a DM or Lounge renders as raw markdown text. This is the drift you described, and it is real.
- **Two entity searches.** `src/lib/mention-suggestions.ts` (six hooks, RLS-scoped client queries) and
  `src/components/blog-entity-tag-picker.tsx` (five inline `useQuery` blocks over the same tables) solve
  the same problem with different filters and different result shapes.
- **Three visibility opinions.** In the Blog resolver (`src/lib/blog-entity-tags.server.ts`, `resolveTags`):
  - **Collabs get no `publicOnly` filter at all** — an archived or non-public Collab still resolves onto a
    public post. This is a live privacy gap.
  - **Events are filtered on `visibility === "private"`**, which is not a value in the `group_event_visibility`
    enum (`public | group_only | unlisted`). The check never fires, so a **group-only event resolves publicly**.
    The parent Group's visibility is fetched but not enforced.
  - Works, Groups and Profiles are checked correctly.
- **Reverse rails already share one path** — `listBlogPostsForEntityServer` behind `EntityBlogPosts`, used by
  Work, Collab, Event and Profile pages, plus `group-posts-tab`. Good; keep it, harden invalidation.
- **Editor ordering is misleading.** Tags carry a global `sort_order`, but `deriveBlogPostContext` regroups
  by kind, so dragging an Event above a Work has no visible effect.

## Waves

**Wave 1 — Shared entity model.** New client-safe `src/lib/entities/` with `WorkshopEntityKind`
(`profile | work | post | collab | group | event`), `WorkshopEntityRef`, and one URL resolver
`workshopEntityUrl()`. `entityUrl()` in `blog-entity-tags.ts` and every hand-built path in the parsers and
`mention-suggestions` delegate to it. `BlogEntityTag` becomes a richer *extension* of the shared ref, so the
Blog's Work card data survives untouched. No migration.

**Wave 2 — One visibility policy.** New `src/lib/entities/visibility.server.ts` exposing a single
`filterReferenceable(kinds, ids, viewer)` used by the Blog resolver, validation, and search. It delegates to
existing domain helpers (`src/lib/collab/*`, `src/lib/events/filters`) rather than restating rules. Fixes,
with tests:
- Collabs: apply public/lifecycle filtering — but **referenceable ≠ recruiting**. A completed or closed public
  Collab stays valid editorial context; only non-public/archived ones drop out.
- Events: replace the dead `"private"` check with the real enum, and require the parent Group to be public
  and not deleted.
- Works: keep `published + not private`; decide `unlisted` explicitly — resolvable by direct link, **not**
  surfaced as public Blog context.
Anything that fails resolves to nothing: no title, no thumbnail, no URL leaked.

**Wave 3 — One search.** `searchWorkshopEntities({ query, kinds, viewer, context })` in
`src/lib/entities/search.ts`, with contexts `editorial` (Blog: includes past public Events and completed
public Collabs), `conversation` (Today/Lounge/DM), and `mine` (owner-scoped, e.g. Group Work management).
`mention-suggestions.ts` and the Blog picker both become thin adapters over it — same debounce, same caps,
same React Query keys style. Both picker UIs stay exactly as they look today.

**Wave 4 — One parser, one renderer.** `src/lib/entities/parse.ts` holds the single tokenizer (the
today-text one is the mature version) and `src/components/entity/workshop-entity-reference.tsx` renders a
ref as Workshop's existing chip + peek, reusing `WorkPeek`, `CollabPeek`, `GroupPeek`, `EventPeek`,
`BlogPostPeek`, `UsernameMention`. No new visual language.

**Wave 5 — Conversational parity.** `today-text.tsx` and `MessageBody` both consume Wave 4. Works now render
correctly in DMs and Lounge. `@` stays the only gesture; the inserted link format is unchanged, so every
existing message keeps rendering identically.

**Wave 6 — Blog keeps its crown.** "About this post" stays the canonical structured surface and keeps its
richer Work card. It swaps its private search/URL/visibility code for the shared ones. Cap stays at 10.
Editor ordering: reorder **within** each kind only (matching what the public page actually renders) and drop
the cross-kind drag that does nothing.

**Wave 7 — Reverse rails hardened.** Audit `invalidateEntityTagCaches` against every publish/edit/unpublish
path so Work/Collab/Event/Group/Profile rails update on add *and* remove. No new feeds, no redesign.

**Wave 8 — Profile semantics.** Split the two relationships that are currently blurred: **Writing** (posts
authored) vs **Featured in** (posts that reference this person). Labels only; no profile redesign.

**Wave 9 — Group semantics.** Preserve the distinction between durable Group relationships and an ephemeral
Today mention — a Today `@` never becomes a Group tag. Group surfaces adopt the shared search/render.
Low-cost addition: the Group Blog empty state gets "Write about this Group" wired to the existing seed-tag
flow (`src/lib/blog-seed-prompts.ts`).

**Wave 10 — DM message-level context.** One additive migration: `message_entity_refs` (message_id + exactly
one nullable entity FK, RLS mirroring `messages`). Sending from a Work/Collab attaches the ref to *that
message*, so an existing thread can carry new context. Conversation-level `context_*` columns stay and keep
rendering for old threads. No attachments, no embeds, no new messaging modes.

## Explicitly not doing

No universal `entity_edges` table. No new navigation surface. No change to provenance (credits, authorship,
ownership, membership, hosting) — those stay in their domain tables; the shared layer only renders them.
No visual redesign.

## Tests

`workshopEntityUrl` per kind; search respects each context's policy; Work refs render identically across
Today/Lounge/DM; publishing cannot surface a private Work, group-only Event, non-public Group, archived
Collab or non-discoverable Profile; past public Events and completed public Collabs *are* valid Blog
context; reverse rails update on tag add and remove; Group "about this Group" vs "by a member" stays
distinct; existing conversations and plain-text messages load unchanged after the migration.

## Order of work

Waves 1-5 are the core and land first. 6-7 follow. 8-10 are polish and can slip without blocking the
consolidation.
