## Change
Replace the hardcoded "Work" chip on Featured cards (profile page) with the work's category label.

**File:** `src/routes/u.$username.tsx` (line 1054)

Import `CATEGORY_LABELS` (already sourced from `@/lib/categories`) and swap:
```tsx
<span …>Work</span>
```
for:
```tsx
<span …>{CATEGORY_LABELS[w.category] ?? "Work"}</span>
```

The "Collab" chip on pinned collabs (line 1069) is left as-is per user scope (only the Work chip was called out).

## Scope
- One file, one JSX text swap plus adding `CATEGORY_LABELS` to the existing import from `@/lib/categories`.
- No styling, layout, or data changes.
