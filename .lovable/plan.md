## Groups launch lock-in pass

Three focused fixes — display + metadata only, no schema or behavior changes.

### 1) Single-item marquee fallback

**`src/components/groups-join-feed-strip.tsx`** — when `items.length === 1`, skip the doubled-loop marquee (which currently drifts "Item · Item · Item…" awkwardly) and render the single item as a static, centered row inside the same bordered shell. Keep the header bar and "Browse all →" action unchanged. Marquee still kicks in for `items.length >= 2`.

### 2) Replace the dead "Suggest a group" link

**`src/routes/groups.index.tsx`** — the closing line under All groups currently links `/groups` back to itself. Swap it for a `mailto:hello@workshopindie.com?subject=Suggest a group` link so the CTA actually goes somewhere until a real submission form exists. Same copy, same styling.

### 3) Social/share metadata for `/groups`

**`src/routes/groups.index.tsx`** — the route's `head()` has `title`, `description`, `og:title`, `og:description` but no `og:image`, `twitter:card`, `twitter:title`, `twitter:description`, or `twitter:image`. Add:
- `twitter:card = summary_large_image`
- `twitter:title` / `twitter:description` mirroring the OG values
- `og:image` + `twitter:image` pointing at the existing site share image if one is already wired in `__root.tsx`; otherwise leave image tags off (no placeholder URLs).

I'll read `src/routes/__root.tsx` first to confirm whether a share image already exists and reuse it; if not, the image tags are skipped and the user can add one later from a single asset.

### Out of scope

- Mobile audit (separate pass — needs preview at narrow widths, not a code change yet).
- Generating a new branded OG image asset (the user hasn't asked for image creation; I'll only wire existing assets).
- Any change to `GroupCard`, `GroupsBrowseByKind`, `GroupsTrendingList`, `FeaturedEventsCompact`, server functions, or schema.
