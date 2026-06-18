## Replace SparkCard with "Join the room" shuffle card

Reframe the left-column card from manifesto/stats into a **personalized opportunity feed** — drawn from the user's groups, shuffling through collabs + workshops you can join. Keep the left column the same width and align its bottom edge with the right-side `Browse by kind` grid.

### New component: `src/components/groups-join-feed-card.tsx`

A single card with:
- **Header row** — kicker "From your groups" + small `Shuffle` button (cycles to next item) + an index pill like `2 / 7`.
- **Body** — one item at a time, cross-faded:
  - Kind chip (`Collab` / `Workshop`) + originating group name (chip → links to `/g/$slug`)
  - Title (font-display, 2-line clamp)
  - One-line subtitle (collab summary or workshop tagline)
  - Tiny meta row (e.g. `3 roles open` / `starts Fri` when available, else member/host avatars)
- **Footer** — primary CTA "Open" → routes to `/collab/$slug` or `/workshops/$slug`; secondary text-button "Skip" advances to next.
- **Auto-shuffle** every ~7s, paused on hover/focus. Manual shuffle resets timer.
- **Empty / signed-out states**:
  - Signed out → "Sign in to see opportunities from your groups" + Sign in link.
  - Signed in, 0 groups → "Join a group to unlock this feed" + scroll-to-clusters button.
  - Signed in, 0 open items → "All quiet in your groups. Browse all" → calls existing `onBrowseAll`.

### New server fn: `listOpenForMyGroups` in `src/lib/group-events.functions.ts` (or a new `src/lib/my-groups-feed.functions.ts`)

Authenticated (`requireSupabaseAuth`). Returns up to 24 items of shape:

```ts
type FeedItem = {
  id: string;
  kind: "collab" | "workshop";
  slug: string;
  title: string;
  subtitle: string | null;
  group: { id: string; slug: string; name: string };
  meta: { rolesOpen?: number; startsAt?: string | null } | null;
};
```

Query plan: read `group_members.group_id` for caller, then in parallel:
- `group_collabs` join `collab_posts` (only `status='open'` / not deleted, future or no deadline) filtered to those group ids.
- `group_workshops` join `workshops` (only `visibility='public'` and not ended) filtered to those group ids.

Merge, de-dup by `(kind, id)`, sort by recency, cap at 24. No schema changes.

### `src/routes/groups.index.tsx` edits

- Swap `GroupsSparkCard` import for `GroupsJoinFeedCard`.
- Left column becomes a flex column with the feed card as the **last child set to `flex-1`**, so it stretches to match the right column's height (which is driven by `GroupsBrowseByKind`). Wrap the right column in `lg:h-full` and add `lg:items-stretch` to the grid so heights equalize.
- Keep `onBrowseAll` / `allGroupsRef` wiring for the empty-state CTA.
- Remove `GroupsSparkCard` import only after the new card renders.

### Out of scope

- No new routes, no schema migrations, no changes to `GroupsBrowseByKind` or the All-groups grid.
- "Start a Group" / "Suggest a scene" / stats are removed from this surface (they were the manifesto card's job; the discovery clusters + header copy already cover the "what is a Group" framing).

### Technical notes

- Auto-rotate via `useEffect` + `setInterval`, cleared on unmount and on hover (track with `onMouseEnter`/`Leave`, `onFocus`/`Blur`).
- Cross-fade with a keyed inner div + Tailwind `transition-opacity` (no extra deps).
- Query: `useQuery({ queryKey: ["my-groups-feed", user.id], enabled: !!user, staleTime: 60_000 })`.
- Height alignment relies on CSS grid `items-stretch` (default) — the existing `lg:grid-cols-12` already does this; just make sure neither column has a fixed height and the feed card uses `h-full flex flex-col` with `flex-1` body.
