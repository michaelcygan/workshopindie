## Add filter strips to Collabs, Events, and Members tabs

Match the Gallery utility strip exactly: right-aligned row of pill buttons using `rounded-full px-2 py-1 text-xs hover:bg-surface-2` with `ChevronDown h-3 w-3`, plus the same expanding search icon (`Search h-4 w-4` → `Input h-8 w-[200px] text-xs`). All applied to the shared Group template — every group inherits.

File: `src/routes/g.$slug.tsx`

### 1. Collabs tab (`GroupCollabTab`, ~line 1105)
Fetch already returns `status` and `resulting_work_id`. Extend the select to include `category`. Add local state for `category`, `status`, `q`, `searchOpen`.

Filter pills (right-aligned, same row as the existing `AddMineToGroup compact` on the left):
- **Category** — dropdown, options built from categories present in the fetched collabs, using `CATEGORY_LABELS`. Default "All".
- **Status** — "Open" / "Completed" / "All". Default "Open" (matches the current visible set: open + closed-with-work).
- **Search** — expanding input, matches `title` + `description` case-insensitive.

Empty-filter state mirrors Gallery: `No Collabs match "{q}". Clear`.

### 2. Events tab (`GroupEventsTab`, ~line 377)
Add local state for `kind`, `format`, `q`, `searchOpen`. Utility strip sits directly under the existing header (below the subheading, above "Pinned & recurring").

Filter pills (right-aligned):
- **Kind** — dropdown built from distinct `kind` values across `all` events (open mic, screening, workshop, meetup, etc.). Default "All".
- **Format** — "In-person" / "Online" / "All", driven by `format` field. Default "All".
- **Search** — matches `title` + `tagline` + `venue_name`.

Filters apply to both `pinnedOrRecurring` and `upcoming`; `past` stays unfiltered inside its collapsed `<details>`. The "+ Add event" admin pill stays in the header (already there).

### 3. Members tab (`GroupMembersTab`, ~line 1170)
Extend the profile select to include `categories` (array of `category` enum) and add local state for `category`, `q`, `searchOpen`. Currently `mediums`/`tools` are richer but noisy for a filter dropdown — `categories` is the same taxonomy Gallery/Collabs use, so it stays consistent across all four tabs.

Filter pills (right-aligned, on a new row above the members grid):
- **Craft** — dropdown built from categories present in the loaded members, using `CATEGORY_LABELS`. Default "All". A member matches if their `categories` array includes the selected value.
- **Search** — matches `display_name` + `username` case-insensitive.

Empty-filter state: `No members match "{q}". Clear`.

### Out of scope
- No new server functions, no schema changes.
- Not adding a `mediums`/`tools` filter to Members this pass (categories keeps taxonomy consistent with the other tabs; can add as a second dropdown later if you want).
- No changes to Today or About tabs.
- No mobile-specific layout changes beyond the existing `flex-wrap`.