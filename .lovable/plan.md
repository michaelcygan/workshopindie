## Audit: Group page (visual + wiring)

The screenshot reads as shippable. A few real issues remain — mostly small polish + one wiring inefficiency worth fixing before launch.

### 1. Visual polish (small)

- **Avatar feels stranded on the left.** With the shorter banner, the `S` tile sits in a column of empty cream above the tab bar. Tighten by reducing the avatar's negative top offset (currently `-mt-10`) and the gap between hero band and title block so the avatar nests against the banner edge instead of floating.
- **"0 members" + empty meta row on a brand‑new group looks sad.** Hide the members line when count is 0 and the viewer is not a member; replace with a single subtle "Be the first to join" hint. Already‑joined groups keep the count.
- **"In the news" pill is wider than the tab bar baseline.** Constrain the ticker container to match the tab bar's left/right padding so the page has one consistent gutter.
- **Tab bar + Create button**: on this width the "+ Create" sits flush right and the tabs are flush left — visually they read as two separate components. Add a faint divider under the whole bar (single hairline) so the sticky bar reads as one element when it pins.

### 2. Wiring / data (worth fixing)

- **Membership query duplicated.** `JoinGroupButton` fetches membership, and several tabs re‑derive "am I a member?" independently. Lift one `["group-membership", group.id, user.id]` query into `GroupPage` and pass `isMember` down as a prop. Removes 3–4 redundant requests per page load.
- **Realtime channel re‑subscribes on every tab switch is fine, but the `group-${id}` channel currently invalidates on `group_members` for ALL inserts.** At 100k DAU on a large group this fires constantly for every viewer. Debounce member‑count invalidations (e.g. trailing 5s) and skip invalidation entirely when the change isn't the current viewer.
- **`nextEvent` and `childGroups` always fetch, even when their consumers aren't visible.** `nextEvent` is shown in the hero so keep it. `childGroups` is only used inside the Subgroups tab and to compute `childCount` for the tab bar. Replace the full `select(...)` with a cheap `select("id", { count: "exact", head: true })` for the count, and lazy‑load the full list when the tab opens.
- **Tab state is local React state.** Refresh / share‑link loses the tab. Move `tab` into `validateSearch` (`?t=today|collabs|...`) so deep links land correctly — important for SEO and for the "All events →" / share flows you've already built.

### 3. Findability / SEO

- Head meta is solid (title, og:title, og:description, og:image). Add `og:type=profile` (or `website`) and a `twitter:card` entry for parity. Add `CollectionPage` JSON‑LD with `numberOfItems = member_count` for the group root.

### 4. Cleanup

- The legacy local `Tab` alias (`type Tab = GroupTab`) is unused outside this file — drop it.
- `useEffect` for the realtime channel doesn't unsubscribe cleanly if the channel errors before subscribe resolves. Wrap removal in try/catch.

### Out of scope (intentionally not touching)

- Hero composition, typography sizes, banner color — you've explicitly signed those off.
- "Today" tab layout — you signed it off last pass.
- News ticker behavior — already polished.

### Order of work

1. Avatar nest + members‑row empty state + ticker gutter + tab bar hairline.
2. Lift membership query; convert `childGroups` to count‑first.
3. Move tab to `?t=` search param.
4. Add JSON‑LD + twitter card meta.
5. Drop unused `Tab` alias; harden channel teardown.

Estimated impact: ~6 file edits, no schema changes, no new dependencies.
