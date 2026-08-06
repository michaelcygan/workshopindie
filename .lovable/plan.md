# Admin refinement — final waves

Two pieces remain from the admin/analytics refinement: the per-member detail page and a data-health panel. Both build on the views already in place (`vw_user_activity_day`, `vw_user_activation`, `vw_kpi_periods`).

## Wave A — Member detail page

Today `/admin/users/:id` shows identity, seven counters, actions, subscription, blog access, reports. It does not show where the member came from, whether they activated, or what they actually did over time.

Add to the existing page (same visual system, no rebuild):

- **Identity strip**: home city (name, country), activation state and first creative action (surface + date), plan (Plus / trial / free), roles, and an "excluded from analytics" badge.
- **Activity timeline**: a 90-day per-day strip from `vw_user_activity_day` for this member — creative days emphasised, passive days muted, hover shows surfaces and action counts. Plus a per-surface breakdown table (surface, days active, total actions, last action).
- **Analytics exclusion toggle**: wire the existing `setAnalyticsExcluded` server function into the Actions row, with a confirm and a short note that excluded accounts disappear from every analytics view.
- Keep every existing panel intact.

## Wave B — Data health

A small `/admin/ops` panel (Flags page) plus a compact strip at the bottom of Pulse, answering "can I trust these numbers?":

- Freshness: latest day present in the activity spine, and how stale that is.
- Coverage: members excluded from analytics, members with no home city, profiles missing a username, accounts soft-deleted.
- Integrity: signups with no activity row, activity rows for users with no profile, subscriptions in sandbox vs live.
- Each row renders green/amber with a plain-language sentence — and uses the same `Panel` envelope, so a failed query says "Data unavailable" rather than showing a reassuring zero.

## Technical notes

- New server function `getAdminUserActivity` in `src/lib/admin-users.functions.ts`: admin-gated, reads `vw_user_activity_day` filtered to the user for the last 90 days, plus the member's `vw_user_activation` row and city. Returns `Panel`-wrapped payloads.
- New server function `getAdminDataHealth` in `src/lib/admin-analytics.functions.ts`: a handful of counted queries, each wrapped in `panel()`.
- New components: `src/components/admin/activity-timeline.tsx` and `src/components/admin/data-health.tsx`.
- No schema changes; `analytics_excluded` and all views already exist.
