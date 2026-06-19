# Finish Collab Lifecycle v4 — items 1–6

Goal: round out Open / Closed-Shipped / Closed-Archived so every state feels alive and complete, then ship.

## 1. Open-state owner activity meter

In `src/routes/collab.$slug.tsx`, when viewer is owner and `status === 'open'`, add a single-line meter below the existing "Open Xd" pill:

```
12 views · 3 applicants · 1 share
```

Sources (no new tables):
- views → `count` of `collab_share_events` rows with `kind = 'view'` for this `collab_post_id` (fallback: omit if 0).
- applicants → `count` of `collab_guest_applications` for this post (any status).
- shares → `count` of `collab_share_events` with `kind in ('share','copy_link')` + `collab_contact_events` rows.

Add one server fn `getCollabActivity({ collabId })` in `src/lib/collab.functions.ts` (owner-gated via `requireSupabaseAuth` + `user_id` check). Returns `{ views, applicants, shares }`. Called via `useQuery` only when owner.

Heat hint: if `applicants >= 3` append a muted "Picking up steam" line; if `applicants === 0 && ageDays >= 3` append "Quiet so far — try sharing".

## 2. Per-role "N interested" counts

In the same server fn, also return `perRole: Record<roleId, number>` from `collab_guest_applications` grouped by `role_id`. Render under each role row in the Roles card as a small muted chip: `3 interested`. Visible to owner only (keeps visitor side clean).

## 3. Visitor signals on open Collabs

In `src/routes/collab.$slug.tsx`, visitor view (`status === 'open'` and not owner):
- Replace/augment the meta line with: `Cast so far · posted Nd ago` (cast = total applicants, fetched via the public-safe count; if 0, show `Open to applications · posted Nd ago`).
- When `ends_on` exists and is within 7 days, render a `<StateBadge state="open" sublabel="Closing soon" />` instead of the `Casting` variant, and add a small chip `Closes in Nd` next to the title.

Counts for visitors come from a separate public server fn `getCollabPublicCounts({ collabId })` returning just `{ applicants }` (single integer, no PII). Keep it on the publishable client.

## 4. Closed-shipped hero treatment

When `status === 'closed' && resulting_work_id` (public view), promote the Work into the page header:
- Hero block at the top: Work cover image (16:9 rounded), Work title, byline "From the Collab: <collab title>", primary CTA `View the Work` → `/work/$slug`.
- Collapse the Roles card to a single muted line: `Cast · N collaborators` (count from `work_collaborators` for that work; reuse existing query if present, otherwise add to the loader).
- Keep the existing description + city/timeline meta below for context.
- Owner strip becomes celebratory: `Shipped Nd ago · view the Work` button only (drop the publish CTA).

Loader changes in `src/routes/collab.$slug.tsx`: when `resulting_work_id` is set, also fetch `{ id, slug, title, cover_url }` from `works` and `count` from `work_collaborators`. Surface in head() as `og:image` + `twitter:image` (replaces any current OG image for shipped Collabs).

## 5. StateBadge on CollabCard

In `src/components/collab-card.tsx`, replace the current "live"-style pill with the shared `<StateBadge />`:
- `open` → `Open · Casting` (or `Closing soon` when ends_on within 7 days)
- `closed && resulting_work_id` → `Closed · Shipped`
- archived variant never appears on cards (filtered out of public feeds).

Card visual: badge sits top-left of the card header where the current pill is; keep the rest of the card unchanged.

## 6. Surface shipped Collabs on the board

In `src/routes/collab.index.tsx`, change the primary list query from `.eq('status','open')` to:

```ts
.or('status.eq.open,and(status.eq.closed,resulting_work_id.not.is.null)')
```

Apply the same change to:
- `src/routes/index.tsx` (home "Open Collab calls" section) — keep the section title; shipped cards still belong here because they're proof the system works.
- `src/routes/cities.$slug.tsx` city Collab list.
- `src/lib/my-groups-feed.functions.ts` (drop the `c.status !== 'open'` filter; replace with `if (c.status === 'closed' && !c.resulting_work_id) continue;` and add `resulting_work_id` to the select).
- `src/routes/g.$slug.tsx` GroupCollabTab.

`u.$username.tsx` `fetchOpenCollabs` stays Open-only (separate "Shipped" surface is the Works tab there).

Sort: keep `created_at desc` for now — mixing shipped + open chronologically is fine for v1; revisit if owners ask for "shipped pinned".

Add a tiny filter pill row at the top of `/collab` board: `All · Open · Shipped` (URL search param `view=all|open|shipped`, default `all`). Wires into the same query with conditional `.eq('status','open')` or the shipped half of the OR.

## Files touched

- `src/lib/collab.functions.ts` — add `getCollabActivity`, `getCollabPublicCounts`.
- `src/routes/collab.$slug.tsx` — owner meter, per-role chips, visitor signals, shipped hero, loader work fetch, OG image.
- `src/components/collab-card.tsx` — StateBadge integration.
- `src/routes/collab.index.tsx` — query change + view filter pills.
- `src/routes/index.tsx`, `src/routes/cities.$slug.tsx`, `src/routes/g.$slug.tsx`, `src/lib/my-groups-feed.functions.ts` — query carve-out for shipped.

## Out of scope (still v1.1+)

Reopen, notifications fan-out on shipped, "shipped pinned" sort, profile "Shipped Collabs" tab, applicant funnel analytics, owner email digest of activity.

## Launch step

After items 1–6 land and the preview looks clean, call `preview_ui--publish` with updated site metadata so the deploy goes out.
