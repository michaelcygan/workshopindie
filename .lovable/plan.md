## Changes to `src/components/top-nav.tsx`

**1. Center nav** — replace the individual `Events` and `Gallery` links with a single "More" dropdown:

```
Lounge · Groups ▾ · Collabs · More ▾
```

The "More" dropdown (using existing `DropdownMenu` primitives) contains:
- Events → `/events`
- Gallery → `/gallery`
- Blog → `/blog`

The trigger uses the same `navLinkBase` styling as sibling links, with a small chevron. It receives `navLinkActive` styling when the current route matches `/events`, `/gallery`, or `/blog` (checked via `useRouterState` on `location.pathname`).

**2. Avatar dropdown** — remove the standalone "Blog" `DropdownMenuItem` (and its now-redundant `BookOpen` usage in that spot) since Blog is now reachable from the top-level "More" menu. Leave "Blog posts" under the "My stuff" submenu untouched (that's the user's own posts, different destination `/me/blog`).

No mobile changes — mobile nav (bottom island) is unaffected.
No other files touched.
