Wave 2 is done. Notification deep-links, the "You're invited" strip on the Lounge index, the "Live in your Groups" rail, and the Group Today Lounge card all shipped, and the typecheck is clean.

# Wave 3 — Remove retired Vouch and Boost systems

## What the audit found

Verified against the codebase and the live database this turn:

- `work_vouches`, `work_boosts`, `collab_vouches`, `collab_boosts` all have **0 rows**.
- Every `works.vouch_count` / `boost_count` / `popularity_score` and `collab_posts.vouch_count` / `boost_count` value is **0**.
- **No application code writes** to any vouch/boost table — the only writers are DB counter triggers, which can never fire with no inserts.
- No feature flag, notification kind, or background job references vouch/boost.
- Remaining influence is: one ranking term, several unnecessary column selects, three UI affordances, two realtime subscriptions, and one admin KPI tile.

## Changes

**1. Ranking (the only live behavioral influence)**

`src/routes/collab.index.tsx` — the blended sort adds `vouch_count * 4h` to each post's score. Remove that term. The sort keeps its existing deterministic signals: recency plus the roles/suggestions bump.

**2. Stop selecting the retired columns**

Drop `vouch_count` and `boost_count` from these queries:
- `src/routes/gallery.tsx` (two selects, plus the mapped fields on both result shapes)
- `src/routes/works.$slug.tsx`
- `src/routes/collab.index.tsx`
- `src/lib/group-events.functions.ts` (collab select and work select)
- `src/lib/mcp/tools/search-works.ts` (`boost_count` is returned to MCP clients; drop it)

`popularity_score` stays — it is a separate active ordering signal, unrelated to vouch/boost.

**3. Remove the UI**

- `src/components/work-card.tsx`: remove the "Boosted" rocket pill and the shield/vouch-count badge, plus their props (`vouch_count`, `boost_count`) and the now-unused `Rocket`/`ShieldCheck` imports.
- `src/components/collab-card.tsx`: remove the `boosted` ring/border treatment and "Boosted" chip, and the deprecated `vouchers` / `boosted` props and `vouch_count` / `boost_count` type fields.
- `src/components/gallery-logged-out-hero.tsx`: rewrite the "Vouch for what moves you." line in the hero copy to reference an active signal instead.

**4. Remove dead realtime plumbing**

`src/routes/gallery.tsx`: delete the `work_vouches` and `work_boosts` realtime channel subscriptions and the invalidations for the retired `["work-vouchers-batch"]` and `["boosted-works"]` query keys (neither key has a producer anymore).

**5. Admin reporting**

`src/routes/admin.marketplace.tsx`: remove the "% with vouches (90d)" KPI tile. It reads `vw_marketplace_health.pct_with_vouches_90d`, which is now permanently 0% and misleading. The view itself is left untouched until the Wave 9 schema pass.

## Deliberately deferred to Wave 9

No schema changes in this wave, per the plan's "verify before removing" rule:
- Columns `works.vouch_count`, `works.boost_count`, `collab_posts.vouch_count`, `collab_posts.boost_count`
- Tables `work_vouches`, `work_boosts`, `collab_vouches`, `collab_boosts`
- Counter/guard triggers `tg_work_vouches_counter`, `tg_work_boosts_counter`, `tg_collab_vouches_counter`, `tg_collab_boosts_counter`, `tg_work_vouches_guard`, `tg_collab_vouches_guard`
- The `pct_with_vouches_90d` column on `vw_marketplace_health`

These stay inert. Keeping them means this wave is fully reversible with a code revert.

## Acceptance criteria

- Collab list ordering no longer reads `vouch_count`; ordering is recency + roles/suggestions only.
- No client request fetches `vouch_count` or `boost_count`.
- No UI renders "Boosted", a vouch count, or vouch-flavored copy.
- Gallery, Works detail, Collab index, Group event pages, and the MCP work search all load correctly.
- `tsgo` typecheck clean.

## Verification

Typecheck, then a Playwright pass over `/gallery`, `/collab`, a Work detail page, and a Group event page to confirm rendering and ordering are unchanged apart from the removed chips.

## Risks and rollback

Low. All affected data is zero-valued, so no visible ranking or count changes. Rollback is a code revert — no migration to undo.
