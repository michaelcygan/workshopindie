# Launch Lock-In Plan

A subagent swept the codebase mapping how Workshop, Collab, Work, Groups, Events, DMs, Profiles interconnect. The product graph is clean (no broken `Link to=` targets, no orphan public routes). What follows are the real launch risks worth fixing before going live — grouped by severity.

> Note: One audit finding (a claimed `staleTime` typo in `src/router.tsx`) was a misread — that line is already correct and is excluded below.

---

## Critical (security / correctness)

### 1. SSRF: `extractWorkFromUrl` is an open URL-fetch proxy
`src/lib/works-import.functions.ts` — the `extractWorkFromUrl` server fn fetches arbitrary external URLs server-side with no auth middleware. Anyone can call it to probe internal IPs or amplify traffic.
**Fix:** add `.middleware([requireSupabaseAuth])`. If a public path is needed, also add a hostname allowlist / block private IP ranges.

### 2. SSR auth leak on `/workshop/$id`
`src/routes/workshop.$id.tsx` — auth check lives in `useEffect`, so the page SSR-renders for signed-out users and fires Supabase queries that silently return null under RLS. Move this under `_authenticated/` (preferred — matches DMs/Me) so the integration-managed gate handles it. Same treatment for `/workshop/` (live lobby) so Drop-in / Host CTAs don't surface raw 401 toasts.

### 3. `/workshop/$id` missing `notFoundComponent` + `errorComponent`
Bad room ID currently renders a blank page indefinitely. Add both boundaries and throw `notFound()` once `room === null` resolves.

## High (visible at launch)

### 4. `/collab/$slug` share cards show the URL slug as the title
`src/routes/collab.$slug.tsx` — `head()` builds OG tags from `params.slug` only, so every social share of a Collab post shows e.g. "looking-for-editor-spring-tape" as the title. Add a public server fn `getCollabSeo(slug)`, wire a `loader`, and read `loaderData` in `head()` for real `title` / `description` / `og:image` (use group cover or accent). Add `canonical`.

### 5. `/workshops/$slug` missing `og:image`
Public, shareable, has a cover available — just not piped into `head()`. Add `og:image` + `twitter:image` from the existing cover, plus `canonical`.

### 6. DMs routes have no `head()`
Both `dms.index.tsx` and `dms.$conversationId.tsx` inherit the root title. Add minimal `head()` ("Messages — Workshop" / "DM with @{username} — Workshop"). Mark `noindex` since they're private.

## Medium (scale + hygiene)

### 7. Sign-out cache hygiene
Root `onAuthStateChange` invalidates queries but never `queryClient.clear()`s on `SIGNED_OUT`. On shared browsers, a second sign-in briefly sees the previous user's cached DMs/notifications. Add `clear()` on sign-out in the root listener (aligns with the `tanstack-auth-guards` Sign-Out Hygiene rule).

### 8. Unbounded `select("*")` on hot paths
- `src/lib/account.functions.ts` — the export `Promise.all` has 7 unbounded selects; add `.limit(500)` per branch (or paginate). A power user will timeout this fn.
- `src/routes/workshops.$slug.tsx` — `workshop_applications` query has no limit; cap at 100 with a "view all" overflow.
- Same file — narrow the `workshops` `select("*")` to explicit columns.

### 9. `/workshop/$id` polls 3 queries every 5–8s
`instant_rooms`, `instant_presence` count, and participants each poll independently (~18 round-trips/min/user in a live room). Consolidate into a single presence query or switch to Supabase realtime channel for presence; keep polling only as fallback.

---

## Out of scope (intentionally deferred)

- Collab board pagination (S1): current 60-item cap is fine until volume justifies cursor pagination.
- Workshop → Group back-link (one-way): nice-to-have, not blocking.
- `/works/collab/new` orphan route: leave wired via direct URL; decide later whether to surface in nav or delete.
- `/cities/$slug` ↔ Gallery cross-linking: SEO polish, not launch-blocking.

---

## Suggested execution order (parallelizable)

```text
Batch A (security)       Batch B (SEO)              Batch C (hygiene)
  1. SSRF middleware       4. Collab head() loader    7. Sign-out clear()
  2. Move /workshop/*      5. Workshop og:image       8. Query limits
     under _authenticated  6. DMs head()              9. Presence consolidation
  3. workshop.$id 404                                    (optional, can defer)
```

A + B should land before launch. C7 + C8 are quick wins to include. C9 is the only item worth deferring if time-boxed — it's a load risk, not a correctness bug, and only matters once concurrent live-room users climb.

Approve and I'll execute in the order above.
