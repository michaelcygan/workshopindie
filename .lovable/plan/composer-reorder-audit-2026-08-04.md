# Composer reorder + audit

## Change

Reorder the create/composer actions everywhere to:

1. Write a blog post → `/me/blog`
2. Post a Collab → `/collab/new`
3. Post to Gallery → `/works/new`

Two files hold the order:

- `src/components/mobile-island/mobile-tabs-config.ts` — `mobileCreateActions` array (mobile bottom-sheet composer). Reorder the three entries; the sheet animates in list order, so no other change needed.
- `src/components/top-nav.tsx` — desktop "Create" dropdown items. Reorder the three `DropdownMenuItem`s; admin "Add event" stays last behind the separator.

## Audit: is the composer fully wired?

Current state confirmed in code:

- All three destinations exist as real routes (`me.blog.index.tsx`, `collab.new.tsx`, `works.new.tsx`), so every item lands on a live page.
- Mobile composer and desktop dropdown are the only two places the three-item composer renders; they will stay in sync after the reorder.
- Admins get a fourth item ("Add event" → `/admin/events`) on desktop only. Mobile admins have no equivalent.

## Optional additions (say yes/no, none are built unless you approve)

- Add "Add event" to the mobile composer for admins so the two surfaces match.
- Add "Post to Today" / group post as a fourth item for members who have a home group.
- Add short descriptions to the desktop dropdown items (mobile already shows them).

Default if you say nothing: just the reorder, no new items.
