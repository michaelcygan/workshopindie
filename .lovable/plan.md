## Fix: "Larger view" button widens the wrong column

### Root cause
In `src/components/channel-view.tsx` (line 690), the focus toggle swaps the grid template:

```tsx
videoFocus
  ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"  // ← second (sidebar) column gets 1.6fr
  : "md:grid-cols-[1fr_260px]"
```

The first column is the video stage and the second is the right-hand sidebar. The `1.6fr` is currently applied to the sidebar, which is why clicking the Columns2 icon makes the sidebar grow instead of the video area.

### Change
Swap the fractions so the video column gets the larger share when focused:

```tsx
videoFocus
  ? "md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
  : "md:grid-cols-[1fr_260px]"
```

That single edit makes the "larger view" icon expand the video stage (and the row of artist tiles inside it) while the sidebar shrinks back to a reasonable width — matching the user's expectation.

### Verify
- Open a live Workshop, click the Columns2 icon: video stage widens, sidebar narrows.
- Click again (MessageSquare icon): layout returns to the default `1fr_260px`.

No other files need to change.