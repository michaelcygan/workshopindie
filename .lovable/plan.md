## Fix profile action row on mobile

**Problem:** On the profile page, the action buttons (`Follow`, `Message`, `Share`, `Report`, `Block`) are all rendered in a single `flex-wrap` row aligned to `items-end` next to the avatar. Five buttons don't fit on a mobile width, so they wrap — the primary `Follow` button ends up on the top row overlapping the cover image, with `Share / Report / Block` awkwardly on the second row.

**Fix:** Keep only the primary actions inline on mobile and collapse the secondary ones into an overflow menu.

### File: `src/routes/u.$username.tsx` (viewer-is-not-owner branch, ~lines 547–561)

Restructure into two groups:

- **Primary (always visible):** `FollowButton`, `MessageButton` — these are the actions users are here to take.
- **Overflow (mobile: kebab `MoreHorizontal` menu; desktop: inline as today):** `ShareSheet`, `ReportDialog`, `BlockButton`.

Implementation:

```tsx
<>
  <FollowButton targetUserId={profile.id} />
  <MessageButton otherUserId={profile.id} />

  {/* Desktop: inline */}
  <div className="hidden md:contents">
    <ShareSheet ... />
    <ReportDialog entityType="profile" entityId={profile.id} />
    <BlockButton targetUserId={profile.id} />
  </div>

  {/* Mobile: overflow menu */}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="icon" className="rounded-full md:hidden" aria-label="More">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => shareRef.current?.open()}>Share</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => reportRef.current?.open()}>Report</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => blockRef.current?.open()}>Block</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</>
```

Since `ShareSheet` / `ReportDialog` / `BlockButton` each render their own trigger button, the cleanest approach is to render a second (mobile-only) instance inside the dropdown that renders trigger-less variants — but to keep scope tight and avoid touching those components, use the simpler approach below.

### Simpler approach (no changes to Share/Report/Block components)

Wrap the whole secondary group in a container that on mobile becomes vertically stacked and visually compact:

```tsx
<div className="flex items-center gap-2">
  <FollowButton targetUserId={profile.id} />
  <MessageButton otherUserId={profile.id} />
</div>
<div className="flex items-center gap-2">
  <ShareSheet ... />
  <ReportDialog entityType="profile" entityId={profile.id} />
  <BlockButton targetUserId={profile.id} />
</div>
```

On mobile, force the outer row to `flex-col items-end` so the primary pair sits on the top line (next to the avatar) and secondary actions sit on a clean second line below — no overlap with the cover. Update the parent from:

```
flex-wrap items-center justify-end gap-2 pb-2
```

to:

```
flex-col md:flex-row md:flex-wrap items-end md:items-center justify-end gap-2 pb-2
```

The avatar row's `items-end` still aligns the primary row's baseline with the avatar bottom; the secondary row wraps under it, entirely below the cover.

### Scope
- Only the profile page action-row layout for the non-owner case.
- No changes to `FollowButton`, `MessageButton`, `ShareSheet`, `ReportDialog`, `BlockButton`, or the owner branch.
- No backend/schema changes.

Recommend the "Simpler approach" — minimal risk, no component refactors, fixes the overlap. Confirm and I'll ship it.
