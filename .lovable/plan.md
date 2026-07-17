## Two real fixes on the Group Today tab

### 1. Recent Collabs is broken by a schema mismatch — not the filter

The `group_collabs` table actually has columns `group_id`, `collab_post_id`, `added_by`, `created_at`. The `RecentCollabs` query in `src/components/group/group-today-tab.tsx` selects `added_at` (doesn't exist) and embeds `collab:collab_posts(...)` without an FK hint. Supabase returns an error, the query resolves to `[]`, and the module renders empty — regardless of my previous status-filter change.

Chicago has 3 real `group_collabs` rows; the module still shows empty because the query itself fails.

Fix in `RecentCollabs`:
- Replace `added_at` → `created_at` in both `.select(...)` and `.order(...)`.
- Add an explicit FK hint on the embed: `collab:collab_posts!collab_post_id(...)` so PostgREST resolves the relationship deterministically.
- Keep the "show any status, subtle pill when not open" behavior from the previous pass.
- Surface fetch errors via `useQuery`'s `error` so silent failures like this don't happen again: render a tiny "Couldn't load — retry" line in the sidebar card instead of the empty state when `error` is set.

### 2. Chat container still bleeds past the fold

Current clamp is `h-[clamp(240px,34vh,380px)] xl:h-[46vh]`. On the user's laptop viewport (~800px, below the `xl` 1280 breakpoint) the scroller + header + composer + page chrome push the "Send" button below the fold.

Tighten to `h-[clamp(180px,26vh,300px)] xl:h-[38vh]`. That keeps the scroller visible on the smallest laptops (~180px) while allowing large desktops to breathe. Composer stays anchored at the bottom of the section, which itself now fits inside a standard laptop viewport with the whole Group header + tab bar above it.

### Files touched
- `src/components/group/group-today-tab.tsx` — RecentCollabs query fix + error surfacing, chat scroller clamp reduction.

No schema, no server-fn, no other files.
