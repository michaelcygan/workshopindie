# Wave 7 — Migrate historical LegacyWorkshop relationships

Wave 6 is complete (Group Blog tab shipped). Here is Wave 7.

## Audit findings (verified this turn)

**There is no historical data to migrate.** Production counts:

| Check | Rows |
| --- | --- |
| `works` total | 12 |
| `works.source_workshop_id` not null | **0** |
| `works.source_type = 'workshop'` | **0** |
| `works.source_collab_post_id` / `source_meetup_id` not null | 0 / 0 |
| `workshops` | **0** |
| `workshop_participants` | **0** |
| `work_credits` | 12 (none tied to a LegacyWorkshop) |
| `instant_rooms` (Lounge) | 74 |
| `collab_posts` | 3 |

So no Work needs re-pointing, no credit needs rescuing, and no archive/audit table is warranted — there is nothing to archive. What remains is **dead UI that would link into a retired interface** and **admin metrics that describe the retired product**.

Dead-end surfaces still in the code:

- `src/components/enter-workshop-button.tsx` — queries `workshops` + `workshop_participants` and links to `/workshops/$slug`. Rendered on the Work detail page (`src/routes/works.$slug.tsx:317`) whenever `source_workshop_id` is set.
- `src/components/work-credit-layer.tsx:52-65` — "Born in this Workshop · {title}" provenance chip linking to `/workshops/$slug`.
- `src/lib/work-provenance.functions.ts` — reads the `workshops` table for both `getWorkProvenance` and the `workshop_id` branch of `getWorksBySource` (the reverse rail is only used by `collab.$slug.tsx`, with `collabPostId`).
- Admin metrics: `vw_kpi_now` exposes `workshops_created_7d`, `workshops_total`, `workshop_apps_7d`; `vw_engagement_by_surface_7d` lists `workshops` and `workshop_applications` surfaces; `vw_workshop_funnel` drives an entire "Workshops" section on `/admin/marketplace`; `admin-users.functions.ts` counts `workshops` + `workshop_applications` per user. All read empty tables, so the dashboard reports zeros for the retired product and says nothing about Lounge, Groups, or Blog.

Out of scope for this wave (belongs to Wave 8): deleting `/workshops/*` routes, `workshop-*.functions.ts`, the Workshop-tools components, and the ad "Workshop links" admin page.

## Changes

**1. Work detail — no link into a dead room**
- Delete `src/components/enter-workshop-button.tsx` and its usage in `src/routes/works.$slug.tsx`.
- In `work-credit-layer.tsx`, the Workshop provenance chip becomes a **non-clickable** chip reading "Made together on Workshop" (kept only because the field could theoretically be set; it renders for zero current rows). The Collab chip is unchanged and stays the primary provenance link.

**2. Provenance reads stop touching legacy tables**
- `getWorkProvenance` drops its `workshops` lookup and returns `made_on_workshop: boolean` (derived from `source_workshop_id`) instead of a `workshop` object.
- `getWorksBySource` drops the unused `workshop_id` branch; it keeps `collab_post_id`, its only live caller.

**3. Admin metrics describe the current product** (one migration, views only)
- Replace `vw_kpi_now`'s three Workshop columns with: `lounge_rooms_opened_7d`, `lounge_participants_7d` (unique), `lounge_audio_minutes_7d`, `blog_posts_published_7d`, `group_events_7d`. Existing columns (users, DAU/WAU/MAU, works, collabs, RSVPs, subs, follows, reports) are unchanged.
- Replace the `workshops` / `workshop_applications` rows in `vw_engagement_by_surface_7d` with `lounge_messages`, `group_today`, and `blog_posts` surfaces.
- New `vw_lounge_funnel` (rooms created 30d, live now, unique participants 30d, audio minutes 30d, chat messages 30d) replaces `vw_workshop_funnel` in `getAdminMarketplace`.
- `/admin` KPI tiles and the `/admin/marketplace` "Workshops" section are re-labelled to Lounge / community metrics accordingly.
- `admin-users.functions.ts` swaps the per-user `workshops` / `workshop_applications` counts for Lounge rooms opened and Works published; `/admin/users/$id` labels follow.
- `vw_workshop_funnel` is **left in place, unused**, and dropped in Wave 9 alongside the tables — no destructive DB change this wave.

## Database changes

One migration, additive/replace only, no table or column drops and no data writes:
- `CREATE OR REPLACE`/recreate `vw_kpi_now`, `vw_engagement_by_surface_7d`
- `CREATE VIEW vw_lounge_funnel`
- Grants re-applied on each recreated view to match current privileges.

## Acceptance criteria

- No Work page renders a control that navigates to `/workshops/*`.
- Contributor credits render exactly as they do today (the `CreditStrip` is untouched).
- `/admin`, `/admin/marketplace`, `/admin/engagement`, and `/admin/users/$id` show Lounge, Group, Event, Works, Blog and Plus metrics — no Workshop KPI tiles.
- No runtime read of `workshops` or `workshop_participants` remains outside the still-existing (Wave 8) `/workshops/*` routes.
- `tsgo` clean apart from the known pre-existing router search-param errors.

## Verification

Typecheck, then a Playwright pass: a Work detail page (credits + Collab chip intact, no Enter-Workshop control), `/collab/$slug` ("Works born here" rail still renders), and the four admin pages signed in as admin — checking each tile resolves and the console is clean.

## Risks and rollback

Main risk is a recreated view losing a grant or a column the UI still reads; the migration re-grants explicitly and every consuming tile is updated in the same wave. Views are recreated, not dropped-with-data, so rollback is re-running the previous view definitions plus a code revert.

## Deferred to Wave 8/9

Deleting `/workshops/*` routes and their server functions/components, the admin "Workshop links" ad tool, then dropping `vw_workshop_funnel`, the `workshop_*` tables, and `works.source_workshop_id`.
