# Link in Bio — copy your profile URL

The Share sheet already handles the share flow (Copy link works on the profile share). We'll add a **subtle Link-in-Bio row inside Profile Edit** so users find it when they're setting up their profile.

## What to build

A small, quiet row in `/me/edit` → **Identity** section, tucked right under the Username field (which already says "Your public @handle — used in your profile URL"). It looks like a compact pill showing the URL with a copy icon on the right.

### Visual

```text
Username: [ michael-cygan            ]
Your public @handle — used in your profile URL.

┌─────────────────────────────────────────────────┐
│ 🔗  workshopindie.com/u/michael-cygan   [Copy] │
└─────────────────────────────────────────────────┘
Use as your link in bio — Instagram, TikTok, email signature.
```

- Rounded row, `bg-surface` border, single line, truncates the URL on small screens.
- Right-aligned `Copy` button → toggles to `Copied` with a check for ~1.8s (matches ShareSheet pattern).
- Muted helper caption below.
- Only shows when `form.username` is non-empty; if empty, replace with a one-line muted hint: *"Pick a username to get your link-in-bio URL."*
- No new component file needed — inline in `me.edit.tsx`.

### Behavior

- URL = `${window.location.origin}/u/${form.username}` (recomputed as they edit the username).
- Copy uses `navigator.clipboard.writeText`, `toast.success("Link copied")` on success, `toast.error` on failure.
- Reuses `Copy`/`Check` icons from `lucide-react` (already imported elsewhere in the file if not, add).
- No backend, no schema, no new routes.

## Share sheet

Leaving `src/components/share-sheet.tsx` untouched — the existing "Copy link" already covers the share flow the user confirmed works.

## Files

- `src/routes/me.edit.tsx` — add the row inside the Identity section, right after the username input's helper `<p>` (around line 373). Add small `useState` for the copied flag and helper function alongside the existing form state.

## Out of scope

- No new /settings surface.
- No QR code or vanity-link generation.
- No changes to the profile page itself.
