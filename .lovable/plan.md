## Add a visible "Edit Work" button on the work page

There IS already an Edit link on the work page, but it lives in the actions row inside the meta strip alongside Like/Save/Share, so it's easy to miss and doesn't read as an owner affordance. The circle in the screenshot is right next to the "Published …" byline row — that's the natural spot.

### Change — `src/routes/works.$slug.tsx`

**1. Add an "Edit Work" pill next to the Published date (owner only).**

The `PublishedMeta` component (line ~407) renders the `Calendar · Published Jul 17, 2026 · from Lounge …` row. Extend it to accept an `isOwner` boolean and, when true, append a compact button:

```tsx
{isOwner && (
  <>
    <span aria-hidden>·</span>
    <Link to="/works/$slug/edit" params={{ slug }} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-ink hover:bg-muted">
      <Pencil className="h-3.5 w-3.5" /> Edit Work
    </Link>
  </>
)}
```

Pass `isOwner={user?.id === work.created_by}` and `slug={work.slug}` from the parent where `PublishedMeta` is rendered.

**2. Remove the duplicate small Edit button** from the meta strip (line ~248–254) so there's a single, obvious owner CTA in the byline area and the actions row stays focused on Like / Save / Share / Report / Pin.

### Notes
- Gating is unchanged (`user?.id === work.created_by`), so non-owners see nothing new.
- Edit destination is unchanged (`/works/$slug/edit`), which already handles description, cover, credits/tagging, links, etc.
- No backend or schema changes.
