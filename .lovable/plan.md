
## Admin Console v1 — investor-grade analytics + ops

Today `/admin` only has Reports, Badges, Groups, Events, Lineups, Links. This plan turns it into a real operator console with the metrics, drill-downs, and tools needed to run a global creative marketplace and answer investor questions.

All data comes from SQL views queried on demand by `requireSupabaseAuth`-protected server fns that check `has_role(admin)`. No new event-tracking pipeline — we use the rich tables we already have (`works`, `collab_*`, `group_event_rsvps`, `workshops`, `workshop_applications`, `subscriptions`, `share_events`, `follows`, `reports`, `profiles`, `cities`, `referral_credits`, etc.).

### New admin nav

```text
Overview · Growth · Engagement · Marketplace · Geo Map · Revenue ·
Users · Moderation · Reports · Badges · Groups · Events · Lineups · Links ·
Ops & Flags · Audit Log
```

---

### 1. Overview (`/admin`) — investor-grade snapshot

Top-of-funnel numbers a Series A deck needs, with WoW / MoM deltas:

- **North star**: Weekly Active Creators (signed-in users who shipped a Work, RSVP'd, applied to a Collab, or hosted a Workshop in the last 7 days).
- KPI tiles: Signups, DAU/WAU/MAU + DAU/MAU ratio, Activated users (created profile + 1 action), Works published, Collabs posted, Collab applications, Workshop RSVPs, Paid subscribers, MRR, Net revenue, Referrals converted.
- Time-series chart: pick metric + range (7d/30d/90d/12m), grouped daily/weekly.
- "What changed this week" auto-summary derived from biggest deltas — copy-paste straight into an investor update.

### 2. Growth

- **Acquisition funnel**: visitor (publish-side share_events) → signup → profile completed → first action → retained day-7.
- **Cohort retention**: weekly signup cohorts × week-N retention heatmap (12 weeks back).
- **Source attribution**: signup count by `referred_by`, by Collab share token, by Workshop link, by `/w/<token>` short link, by city page.
- **Referrals**: top referrers leaderboard with paid-conversion count and months granted.
- **K-factor**: invites sent / signups generated per inviter, rolling 30d.

### 3. Engagement

- **Surface usage**: rows per surface (Works, Collabs, Workshops, Group Events, Instant Rooms, DMs, Comments) — uniques active 7d, actions per active user, % of WAU touching the surface.
- **Creation funnel per surface**: e.g. opened compose → drafted → published; opened Collab editor → posted; opened workshop create → live.
- **Magic-moment counters**: first Work shipped, first Collab posted, first Workshop attended, first crew formed (`relationship_edges`).
- **Stickiness**: DAU/WAU rolling.

### 4. Marketplace (Collabs + Workshops)

- Open vs filled Collabs, time-to-first-application, time-to-fill, application acceptance rate, % posts with ≥1 vouch.
- Guest vs logged-in application split (proves the logged-out wedge).
- Workshop fill rate, no-show rate, repeat-host rate, paid vs free split.
- Top categories/roles by demand and supply, supply/demand imbalance flags.

### 5. Geo Map (lite)

- World map (`react-simple-maps` + the existing `cities` table with lat/lng) with bubbles sized by 7d active users per city. Hover shows city name + active users + works + RSVPs.
- Sidebar list: top 25 cities by 7d activity with click-through to a per-city page (active users, works, collabs, events, hosts, MoM growth).
- Country roll-up tab.

### 6. Revenue

- MRR / ARR, new vs churned MRR by week, paying customers, ARPU, trial conversion %, free-trial→paid funnel.
- Subscription table: filter by tier, status, environment (sandbox/live), with link to user.
- Failed-payment / past_due queue with quick "open in portal" link.
- Boost / credit ledger (`work_boosts`, `collab_boosts`, `referral_credits`, `comp_memberships`) — totals, recent grants.
- Stripe environment toggle (sandbox/live) reflected in every revenue chart.

### 7. Users

- Search by email, username, display name, id, IG handle. Result list shows badge, city, signup date, last activity, plan.
- User detail page: profile summary, role chips (admin/moderator), counts (works, collabs, workshops, applications, RSVPs, follows, referrals), recent activity timeline, reports filed by/against, sessions / DMs counts.
- Actions (each writes to Audit Log): grant/revoke role, change `creator_status` badge, suspend (sets a flag + RLS-respected gate), shadow-flag (hide content from feeds, still visible to author), force sign-out (Auth Admin), delete account (soft, then hard after 30d).
- Read-only "view as" — renders profile/home with this user's id swapped into queries server-side, never logs them in.

### 8. Moderation (expansion of Reports)

- Existing Reports queue stays.
- **Moderation Terms editor**: CRUD on `moderation_terms` with severity (block/warn), live test box.
- **Auto-flag rules**: simple ruleset (e.g. "≥3 reports in 24h auto-hide", "new account + outbound link in DM → warn") stored in a new `mod_rules` table, evaluated by a server fn invoked from existing triggers/sweeps.
- **Bulk takedown**: select multiple reported entities → hide/delete/dismiss in one click.
- **Appeals queue**: a user-facing "appeal this action" form (separate small ticket) feeds into a queue here.
- Every action recorded in Audit Log.

### 9. Ops & Flags

- **Feature flags**: simple `feature_flags` table (`key`, `enabled`, `rollout_pct`, `notes`). A `useFlag(key)` hook reads from a cached server fn. Admin UI toggles + slider for % rollout (hash on user id).
- **Kill switches**: dedicated flags for hot paths (signups, payments, instant rooms, DMs) with a confirmation modal.
- **Curator**: cross-surface featured picker — pin Works, Collabs, Workshops, Groups, Events, Cities in the "Featured" rails from one screen.
- **Seeding tools**: create-city, create-group, seed-members (existing) wired here; add "send platform broadcast" — writes a `notifications` row to all users (in-app only, no email).
- **System health tile**: shows last edge cron run, slow query count, DB size (calls `supabase--db_health` style RPC).

### 10. Audit Log

- New `admin_audit_log` table: actor, action, target_type, target_id, payload jsonb, created_at.
- Every privileged server fn (role grant, suspend, badge change, takedown, flag toggle, broadcast) writes one row.
- Filterable, exportable, immutable (insert-only RLS, admin read).

---

### Technical section

**Data layer** — SQL views in a new migration. Names + purpose:

- `vw_daily_signups`, `vw_dau`, `vw_wau`, `vw_mau`, `vw_dau_mau`
- `vw_signup_cohort_retention` (cohort_week, week_n, retained_pct)
- `vw_acquisition_funnel` (visits, signups, activated, retained_d7)
- `vw_referral_leaderboard`
- `vw_works_funnel`, `vw_collab_funnel`, `vw_workshop_funnel`, `vw_event_funnel`
- `vw_marketplace_health` (collab fill rate, time-to-fill, etc.)
- `vw_city_activity_7d` (city_id, name, lat, lng, active_users, works, collabs, events)
- `vw_country_activity_7d`
- `vw_mrr_series`, `vw_subscription_status_counts`, `vw_failed_payments`
- `vw_admin_user_search` (security-definer fn for fast LIKE search + counts)
- `vw_engagement_by_surface_7d`

Each view filtered to `public` data; nothing leaks PII beyond what an admin already sees. All wrapped by `createServerFn` + `requireSupabaseAuth` + `has_role(admin)` check.

**New tables (migration)**:

```sql
admin_audit_log(id, actor_user_id, action, target_type, target_id, payload jsonb, created_at)
feature_flags(key pk, enabled bool, rollout_pct int, notes text, updated_at, updated_by)
mod_rules(id, key, enabled, threshold int, window_seconds int, action text, notes, updated_at)
admin_broadcasts(id, sent_by, title, body, audience jsonb, sent_at)
```

All with GRANTs (`authenticated` SELECT for flags only via security-definer fn; `service_role` ALL; admin-only via policies using `has_role`).

**Files (additive)**:

- `src/routes/admin.tsx` — extend nav with new tabs.
- `src/routes/admin.index.tsx` — replace with Overview dashboard (move Reports to `/admin/reports`).
- `src/routes/admin.growth.tsx`, `admin.engagement.tsx`, `admin.marketplace.tsx`, `admin.geo.tsx`, `admin.revenue.tsx`, `admin.users.tsx`, `admin.users.$id.tsx`, `admin.moderation.tsx`, `admin.ops.tsx`, `admin.audit.tsx`, `admin.reports.tsx`.
- `src/lib/admin-analytics.functions.ts`, `admin-users.functions.ts`, `admin-moderation.functions.ts`, `admin-ops.functions.ts`, `admin-audit.functions.ts`.
- `src/components/admin/` — `kpi-tile.tsx`, `metric-chart.tsx` (recharts wrapper), `cohort-heatmap.tsx`, `funnel.tsx`, `world-map.tsx`, `user-search.tsx`, `audit-row.tsx`.
- `src/hooks/use-feature-flag.ts`.

**Deps to add**: `recharts` (charts), `react-simple-maps` + `d3-geo` for the lite world map. World atlas TopoJSON loaded from a small static file.

**Performance posture (your call: SQL views + on-demand)**: queries scoped to ≤90d windows by default; expensive views (cohorts, MRR series) gated behind range picker; we add covering indexes where `EXPLAIN` shows seq scans on the big tables (`works`, `group_event_rsvps`, `collab_contact_events`). If a view crosses ~500ms we either narrow its window or convert it to a materialized view later — not in v1.

**Out of scope (v1)**: external analytics pipeline, email sends, A/B framework, ML scoring, server-side event collection. Logged-out funnel uses existing `share_events` only (no new pageview tracker).

**Verification**: seed dashboards render with current data; deltas match hand-rolled SQL; admin actions appear in Audit Log; non-admins hit `/admin/*` and get redirected; published site `/api/public/*` unaffected.

**Phased build order** (one approval, three commits):

1. Migration (views + new tables + grants/policies) + Overview + Growth + Engagement + nav refactor.
2. Marketplace + Geo Map + Revenue + Users (search + detail + actions) + Audit Log writes.
3. Moderation expansion + Ops & Flags + Audit Log viewer + system health tile.
