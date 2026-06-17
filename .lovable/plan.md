
# Group Events — Plan (v3, decisions locked)

Group-scoped events with a Partiful-style page, RSVPs, and a Workshop Pass viral loop. Admin-seeded in v1; peer-hosting opens later.

## Decisions locked

1. **Promo pass length:** **1 month** for both in-person and online. Admin can override per event.
2. **Logged-out viewers:** event pages are public. Clicking RSVP opens an inline signup/login sheet; on completion the RSVP auto-commits.
3. **Attendee visibility default:** `group_only`. Public events show "Going (24)" with avatars hidden for non-members.
4. **No check-in flow.** Online links and full addresses gate only for logged-out viewers; **always visible to any logged-in user**. Promo pass grants on RSVP confirmation, not attendance.

## 1. Data model (new tables in `public`, full GRANTs + RLS)

- **`group_events`**
  - `id`, `group_id`, `slug` (unique), `created_by`
  - `title`, `tagline`, `description` (markdown-lite, ≤6k)
  - `kind`: `open_mic | listening_party | networking | screening | workshop_irl | online | other`
  - `format`: `in_person | online | hybrid`
  - `cover_url`, `accent_color`
  - `starts_at`, `ends_at`, `timezone`
  - `venue_name`, `venue_address`, `venue_city_id`, `venue_lat/lng`
  - `online_url` (nullable)
  - `capacity` (nullable), `waitlist_enabled`
  - `visibility`: `public | group_only | unlisted` (default `public`)
  - `rsvp_mode`: `open | approval | invite_only` (v1 default `open`)
  - `status`: `draft | scheduled | live | completed | canceled`
  - `is_official`, `promo_pass_months` (default **1**; admin-editable)
  - `featured_at`
  - counters: `going_count`, `maybe_count`, `waitlist_count`
  - timestamps + `deleted_at`

- **`group_event_rsvps`** — `(event_id, user_id)` PK
  - `status`: `going | maybe | waitlist | declined | canceled`
  - `plus_ones` (0–2, counts toward capacity)
  - `note` (host-private, ≤280)
  - `promo_pass_granted_at` (idempotency marker)
  - timestamps

- **`group_event_comments`** — Partiful-style wall, ≤500 chars, single-level replies, moderation trigger reused. Read: anyone who can see the event. Write: RSVP'd (`going`/`maybe`) or host.

- **`group_event_updates`** — pinned host announcements; insert fans out notifications.

- **`group_event_cohosts`** — `(event_id, user_id, role)`. Schema present in v1; UI admin-only.

Triggers / RPCs:
- `tg_group_events_autoslug` (reuses `slugify`)
- `tg_group_event_rsvp_counter` — maintains counts; overflow → `waitlist` when capacity hit
- `tg_group_event_rsvp_promote` — on cancel, promote oldest waitlist → notification
- `is_event_host(_event_id, _user_id)` helper
- `grant_promo_pass(_user_id, _months, _reason)` SECURITY DEFINER — inserts or extends a `subscriptions` row (`tier='plus'`, `status='trialing'`, `current_period_end = greatest(now(), existing) + months`). Idempotent per `(event_id, user_id)` via `promo_pass_granted_at`.
- `claim_event_promo_pass(_event_id)` — called by trigger when a `going` RSVP is created; uses event's `promo_pass_months` (0 = no-op).

Abuse guard: at most **one promo pass per 90 days** per user across all events. Later RSVPs still confirm, just don't grant.

RLS highlights:
- `group_events`: public read where `visibility='public' AND deleted_at IS NULL`; `group_only` requires `group_members`; admin writes in v1 (host/cohost writes flip on via `is_event_host` when peer hosting opens).
- `group_event_rsvps`: user reads own + host reads all; user writes own.

## 2. Event page — `/g/$slug/e/$eventSlug` (Partiful-inspired)

Mobile-first, single column, generous cover, warm typography. Public route (SSR + OG image from `cover_url`).

```text
[ Cover w/ accent gradient + status pill (Upcoming · Almost full · Past · Canceled) ]
[ Title · tagline ]
[ Date · local time (event-tz hint if different) · "Add to calendar" (.ics) ]
[ Location card
    - logged-in:  full address + mini map (or "Join link" + copy)
    - logged-out: "City, neighborhood" + "RSVP to see full address / join link" ]
[ Hosted by <group avatar+name>  ·  +cohosts ]
[ RSVP block: Going / Maybe / Can't go; plus-ones stepper; private note
    - logged-out: same block, click → inline auth sheet, then RSVP commits ]
[ Promo pass banner (when promo_pass_months > 0):
    "RSVP → {N} month{s} free Workshop Pass, auto-applied." ]
[ Who's going — avatar stack + "+N" → modal (Going / Maybe / Waitlist)
    - group_only events: avatars hidden to non-members, count only ]
[ About (markdown-lite) ]
[ Host updates (pinned) ]
[ Wall — comments, RSVP'd users only ]
[ Share sheet · Report ]
```

Design tokens only (no hardcoded colors); matches existing cards (`bg-surface`, `shadow-soft`); event/group accent color drives the gradient. Status pill is semantic.

## 3. Logged-out RSVP → signup loop

- Public route renders normally; address/join URL replaced with a soft gate.
- Click RSVP → **bottom sheet**: "RSVP to join — takes 20 seconds" → Google sign-in (primary) + email/password (secondary).
- On auth completion, a `pending_rsvp` cookie (event id + intended status) flushes server-side → RSVP created → page reloads to confirmed state with promo banner visible.
- Composes cleanly with `/refer/$code`.

## 4. Address & online-link gating (final rules)

| Viewer | In-person address | Online join URL |
|---|---|---|
| Logged-out | Hidden (city only) until RSVP | Hidden until RSVP |
| Logged-in (not RSVP'd) | **Visible** | **Visible** |
| Logged-in + RSVP'd | Visible | Visible |
| Canceled event | Visible to RSVP'd only |

No time-window gating, no check-in. Hosts can cancel/update via admin tools, which notifies all RSVPs.

## 5. Workshop Pass grant (RSVP-based)

- On first-ever `going` RSVP per event, `claim_event_promo_pass` runs in a trigger.
- Eligibility: not already on paid Plus; 90-day cooldown across events.
- Eligible: extend/create trialing Plus by `promo_pass_months` (default 1); write `event_promo_pass_granted` notification with CTA → `/me`.
- Ineligible: silent no-op; banner shows "You already have Plus — see you there."
- Reversal: if user cancels RSVP within 24h **and** the grant was within 24h, revoke. After that, grant sticks.

## 6. Surfaces (where events promote themselves)

- **Home (`/`)** — `<FeaturedEventsCarousel />` at top of feed: `featured_at IS NOT NULL AND starts_at > now()`, max 6, sorted by start.
- **Groups index (`/groups`)** — "Happening soon" rail above directory, biased to viewer's joined groups (reuses `useMyGroupIdSet`).
- **Group page (`/g/$slug`)** — new **Events** tab with count badge. Upcoming above the fold; past collapsed. Admin-only "Create event"; "Request to host" affordance disabled with tooltip about the future tier.
- **City page (`/cities/$slug`)** — "Events in <City>" rail.
- **Top-nav `GroupsNavItem`** — adds a "Next event" hint row when one exists in your groups.
- **Profile (`/u/$username`)** — small "Hosting / Going" rail under works (respects `event_visibility`).
- **`/me`** — "Your tickets" tile with date, address/link, quick add-to-calendar.

## 7. Notifications (new kinds + prefs columns)

- `event_invite`
- `event_starts_soon_24h`, `event_starts_soon_2h` (going only)
- `event_updated`
- `event_canceled`
- `event_promoted_from_waitlist`
- `event_promo_pass_granted`
- `event_new_in_my_group` — bundled digest, never spammy
- `event_recap` — 24h after `ends_at`, "How was it?" → wall

All rendered by `notifications-bell`; email prefs added to `notification_preferences`.

## 8. Cron + lifecycle

`src/routes/api/public/events.sweep.ts` cron route (mirrors `workshops.sweep.ts`), every 5 minutes:
- `scheduled → live` at `starts_at`
- `live → completed` at `ends_at`
- Fire `starts_soon` notifications at the right windows (idempotent via `notified_*_at` columns)
- Fire `event_recap` 24h after `ends_at`

## 9. Admin tooling (`/admin/events`)

- Create / edit / cancel events for any group (full event form: kind, format, cover upload, venue search reuses `venue-search`/`venue-map`, online URL, capacity, `promo_pass_months` defaults to 1).
- Toggle `featured_at` per event.
- View RSVP list + CSV export.
- Manual `grant_promo_pass` per attendee (audit-logged).

## 10. UX details

- All times in viewer-local tz with a small "(8pm PT)" hint if event tz differs.
- "Add to calendar" → server-generated `.ics` at `/api/public/events/$id/ics`. No Google-only link.
- Capacity full → CTA becomes "Join waitlist" with position number.
- Empty states warm, not corporate.
- "RSVPs are visible to other group members" hint near the Going button on `group_only` events.

## 11. Technical sketch (file deltas)

- **Migration** `*_group_events.sql`: tables, enums, triggers, RLS, GRANTs, helpers, indexes on `(group_id, starts_at)`, `(featured_at, starts_at)`, `(user_id, status)`. Adds `profiles.event_visibility text DEFAULT 'group_only' CHECK (...)`.
- **Server fns** `src/lib/group-events.functions.ts`: `listGroupEvents`, `listFeaturedEvents`, `listUpcomingForMyGroups`, `getEventBySlug`, `rsvp`, `cancelRsvp`, `listAttendees`, `flushPendingRsvp`.
- **Server fns** `src/lib/group-events-admin.functions.ts`: `createEvent`, `updateEvent`, `cancelEvent`, `setFeatured`, `postEventUpdate`, `grantPromoPassManual`, `exportRsvpsCsv`.
- **Routes**:
  - `src/routes/g.$slug.e.$eventSlug.tsx` (public, SSR)
  - `src/routes/me.tickets.tsx`
  - `src/routes/admin.events.tsx`
  - `src/routes/api/public/events.sweep.ts`
  - `src/routes/api/public/events.$id.ics.ts`
- **Components**: `featured-events-carousel.tsx`, `event-card.tsx`, `event-rsvp-block.tsx`, `event-attendees-modal.tsx`, `event-wall.tsx`, `event-promo-pass-banner.tsx`, `event-location-card.tsx`, `event-countdown.tsx`, `event-share-button.tsx`, `event-rsvp-auth-sheet.tsx`. Group page gains `<GroupEventsTab />`.
- **Hooks**: `use-event-rsvp.ts`, `use-pending-rsvp.ts`.
- **Notifications**: extend `notifications.functions.ts` formatters; add prefs columns; extend `notifications-bell` rendering.

## 12. Out of scope for v1

- Peer (non-admin) event hosting UI (primitives ready).
- Ticketing / paid events.
- Recurring events.
- Native Zoom auto-creation.
- Per-event photo galleries.
- Check-in / door tools / QR tickets.

Ready to build on approval.
