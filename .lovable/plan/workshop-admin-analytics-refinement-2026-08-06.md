# Workshop Admin + Analytics Refinement

## What the audit found

I inspected the admin routes, `admin-analytics.functions.ts`, `admin-users.functions.ts`, and every analytics view in the database.

**Already working and worth keeping**
- 12 admin routes exist (`/admin`, users, growth, engagement, marketplace, revenue, geo, groups, events, moderation, reports, blog, badges, links, plus, ops, audit) with a grouped pill nav.
- 18 SQL views exist and match the names you listed (`vw_kpi_now`, `vw_daily_signups`, `vw_dau_series`, `vw_engagement_by_surface_7d`, `vw_acquisition_funnel`, `vw_signup_cohort_retention`, `vw_referral_leaderboard`, `vw_city_activity_7d`, `vw_country_activity_7d`, `vw_mrr_series`, `vw_subscription_status_counts`, `vw_failed_payments`, `vw_collab_funnel`, `vw_works_funnel`, `vw_lounge_funnel`, `vw_marketplace_health`, `vw_workshop_funnel`).
- Every admin server function re-checks the admin role server-side against `user_roles`. That is correct and stays.
- Structured geography already exists: `cities` has `country_code`, `state_region`, lat/long, merge and provisioning fields, and profiles link via `home_city_id`. No new geo capture model is needed.
- Aggregation is already in SQL, not the browser. Good foundation.

**The central correctness problem**

DAU, WAU, MAU, the DAU series, the cohort heatmap, and city/country "active users" are all derived from a single mutable column, `profiles.last_active_at`. That column is overwritten each visit, so:
- The cohort heatmap is structurally wrong — each user can only ever land in one week column (their most recent activity week), so retention curves cannot be read.
- "DAU series" is not a daily-active series; it is a histogram of when each user was last seen.
- "Active" counts passive browsing, so MAU and Weekly Active Creators cannot be distinguished today.

Every timestamp needed to fix this already exists across `works`, `collab_posts`, `collab_contact_events`, `collab_guest_applications`, `blog_posts`, `group_events`, `group_event_rsvps`, `group_today_posts`, `instant_messages`, `instant_presence`, `lounge_audio_events`, `comments`, `follows`, `group_members`. So this is derivable — **no new client-side event instrumentation is required.**

**Other confirmed gaps**
- `/admin/users` requires a search before showing anything and has no pagination, filters, or sorting; email search pulls `auth.admin.listUsers` page 1 only, so it misses most accounts.
- Nothing excludes admin/test/system accounts from traction metrics.
- `vw_kpi_now` has no prior-period comparisons; almost everything is 7d only.
- Failed queries return `?? []` / `?? null`, so a broken query renders as a convincing zero.
- No "last updated" surface anywhere.
- No `/admin/investor` route.

**Scale note:** production currently has 6 profiles, 3 with a home city. The system must be correct and honest at this size, and the small-sample rules you described matter more than heavy infrastructure. Design for growth; don't over-engineer for volume that isn't here.

## Waves

### Wave 1 — Activity spine + metric definitions (foundation)
- Add `vw_user_activity_day` — one row per (user, day, surface, action count) unioned from the existing tables above. Passive presence is tagged separately so it never counts as creative activity.
- Add derived views on top: `vw_dau_daily` (true daily actives), `vw_user_activation` (first qualifying action per user), `vw_weekly_active_creators`.
- Add `analytics_excluded` boolean on `profiles` (default false) plus a helper `vw_countable_profiles` that filters excluded and soft-deleted accounts. One flag, no hardcoded ID lists; togglable from the user detail page.
- Add `src/lib/analytics/definitions.ts` — the single documented source of truth for Total Member, Signup, DAU/WAU/MAU, Weekly Active Creator, Onboarded, Activated, D1/D7/D30, Active Plus, MRR, ARR run rate, Free→Plus, Collab Application, Active City. Views reference these definitions in comments.
- Indexes on the timestamp/author columns the spine scans.

### Wave 2 — Trustworthy response layer
- Introduce a consistent analytics envelope: `{ data, status: 'ok' | 'unavailable' | 'insufficient', updatedAt }`. Failed queries surface **Data unavailable**, never `0`.
- Shared UI primitives: `<Metric>` (value + delta + small-sample count), `<Unavailable>`, `<NotEnoughData>`, `<UpdatedAt>`.
- Small-sample rule enforced in one place: when a denominator is below a threshold, render `31% · 12 of 39`.
- Safe delta helper: zero prior period renders `+8 vs prior period`, never a percentage.

### Wave 3 — Navigation + Users
- Regroup the nav into Home / People / Analytics / Trust / Manage exactly as specified. No routes removed; same Workshop type and surfaces, calmer hierarchy.
- Rewrite `/admin/users` on a new paginated `listAdminUsers` server function: server-side pagination, search (name/username/email), filters (joined period, active, city/country, plan, role, status, onboarded, activated), sorting (newest, oldest, recently active, most active). Activity-30d comes from one aggregate join against the Wave 1 spine — no per-row queries.
- Email search moves to a targeted lookup rather than page-1 listing.
- Compact user pulse header (Total, 7d, 30d, MAU, Plus, Activated) reading the same canonical views as Overview.
- `/admin/users/$id` keeps its structure; adds activation state, geography, activity timeline from the spine, and the analytics-exclusion toggle.

### Wave 4 — Company Pulse (`/admin`)
Rebuild Overview into the sectioned story: Workshop Right Now (4–6 headline metrics with 30d comparisons), Growth (cumulative membership curve + signups, 7d/30d/90d/1y/all), Engagement (DAU/WAU/MAU, DAU/MAU, WAC, actions per active), Creation & Network (30d with prior-period deltas), Revenue summary, Geography teaser. Extend `vw_kpi_now` with prior-period columns rather than replacing it.

### Wave 5 — Growth + Retention
- Stronger funnel component: absolute count, step conversion, overall conversion, with honest labels (`share_clicks` labelled as share-link visits, not sessions).
- Retention headlines D1/D7/D30 with counts alongside percentages; rebuild `vw_signup_cohort_retention` on the activity spine so cells are real; immature cells render "not available yet" rather than 0%.
- Referral leaderboard gains activation rate; no unnecessary PII.

### Wave 6 — Product surfaces + Marketplace
- Extend engagement-by-surface to 30d with active users, actions, actions/active, new users activated on that surface, and returning-rate; Lounge measured in minutes. Language stays correlational.
- Marketplace: Collabs posted, Collabs with ≥1 application, applications, applications per Collab, unique applicants, guest applications. A match/response rate only if the Collab lifecycle has a reliable accepted state — I will verify before adding it, not invent it.

### Wave 7 — Geography
Global Reach header (countries, cities, active 30d), map and tables sharing one definition and time range, Top Markets table (Members / MAU / New 30d / Activation / Works / Collabs) toggling city vs country, and Emerging Places gated behind a minimum member floor showing both percentage and absolute growth.

### Wave 8 — Revenue
MRR, ARR run rate (labelled `MRR × 12`), active paid, new paid 30d, Free→Plus with a documented denominator, churn only if `subscriptions` history supports it — otherwise an explicit "not measurable yet". Terminology kept separate for Subscription Revenue / GMV / Platform Revenue so later marketplace money never merges into company revenue.

### Wave 9 — Narrative + Investor View
- `src/lib/analytics/narrative.ts`: deterministic template statements from computed metrics, suppressed when the underlying sample is too small. No LLM.
- `/admin/investor`: admin-only, PII-free, editorial layout — Traction, Growth, Retention, Engagement, Geography, Business, Narrative — with generous space, large numerals, restrained charts, print CSS that drops nav and controls.

## Technical notes
- All new aggregation lives in SQL views queried through existing `createServerFn` + `supabaseAdmin` admin functions, with the server-side role check preserved on every endpoint.
- No third-party analytics. No raw IP storage — geography stays derived from the existing `cities` model.
- Each wave ends with a check that shared metrics reconcile across Overview, Users, Geography, and Investor View.

## Open questions I'll resolve during Wave 1 rather than guess
- Whether `collab_guest_applications` / `workshop_applications` states represent a real accepted match (drives whether match rate ships).
- Whether `subscriptions` retains enough status history for honest churn.
