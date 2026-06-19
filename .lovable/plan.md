
# Event page as the activity engine — v1

The event is the only place on Workshop where intent (RSVP), identity (who's coming), and output (collabs + works) collide. Re-cast the page so RSVP changes framing and depth, but never gates work the creator chose to publish to the open web. Add one well-timed in-app nudge before and one after. Give every event a short URL + QR so it survives outside the app.

v1 simplicity: no emails, no new privacy flags, no recap view.

## 1. RSVP-aware event page (open-web first)

Default principle: **public works stay public.** A work's visibility is whatever the creator already set — the event page surfaces what's public to logged-out visitors and adds attendee context on top for RSVPs. No new "attendees only" flag.

One header strip mirrors the viewer's state. No separate RSVP card on desktop until they engage.

```text
┌─────────────────────────────────────────────────────────┐
│ [cover]  Title · Fri 7pm · Venue          [RSVP ▾] [⋯] │
│         Hosted by @anna · 12 going · 3 maybe            │
└─────────────────────────────────────────────────────────┘
```

State drives the body:

- **Logged out / no RSVP** → Full "What people are bringing" rail of attendees' **public** works + open collabs, fully visible and crawlable. Soft CTA: "RSVP to see who else is coming and follow along live." No blur, no paywall.
- **Going / Maybe** → "Your night" panel pinned to top: 3 attendees you don't follow yet + their open collab or freshest public work, "Add to calendar", "Get the link" (short URL + QR), "Bring a +1". Below: the same grid, defaulted to **by-person**, with the in-context "Bring this Friday" / "I'm in" affordances enabled.
- **Declined / waitlist** → quiet view + "We'll text you if a spot opens".

Implementation:
- Promote `EventRsvpBlock` into a compact header pill.
- `g.$slug.e.$eventSlug.tsx` branches on `myRsvp?.status`.
- Server fns `listEventAttendeeCollabs` / `listEventAttendeeWorks` always filter by each row's existing visibility (public-only for the open-web caller; same plus the viewer's own private/limited items when authed). No new visibility column.

## 2. Make collabs/works actionable from the event

Today cards are read-only. Add two inline affordances on each card *in the event context only*, visible to signed-in RSVPs:

- On an **open collab card** owned by an attendee → "I'm in for this Friday" quick-apply, pre-filled with "Met at {event title}".
- On a **work card** → "Bring this Friday" → adds it to the attendee's `event_showcase` list, which renders as a tiny "Bringing tonight" strip on the event page once ≥1 person opts in.

**Showcase chip dedup = social signal.** If multiple people Bring the same work, render **one chip with stacked avatars** (first 3, then "+N"). The chip becomes a real signal about the event itself: people here know each other's work, and conversations will happen because of it. Hovering / tapping a stack expands to the full list of bringers and acts as a soft intro vector ("3 people are bringing this — say hi").

For logged-out viewers the card stays the regular open-web card with no extra chrome, and stacked-avatar chips stay visible — they're public social proof of the event.

New table: `event_showcase_items (event_id, user_id, work_id | collab_id, note, created_at)`. RLS: INSERT by attendee with going/maybe RSVP; SELECT by anyone (visibility ultimately enforced by the joined work/collab row). GRANTs: SELECT to `anon` + `authenticated`, INSERT/DELETE to `authenticated`, ALL to `service_role`.

## 3. Notifications — two in-app pings, no email

In-app only. No email templates, no email infra changes.

1. **T-24h "Who you'll see"** — for every `going` RSVP: notification linking to the event page, copy mentions 2–3 attendees you don't already follow.
2. **T+2h "See what everyone brought"** — single post-event notification linking back to the event page, where the attendee collabs + works grid is now the primary view. No new recap UI — the event page itself is the recap.

Implementation:
- Extend `notifications.kind` with `event_pre_24h` and `event_post_2h`.
- New cron route `src/routes/api/public/events.digest.ts` (mirrors `events.sweep.ts`), runs every 15 min, idempotent per `(user_id, event_id, kind)` so a row is never inserted twice.
- Respect existing `notification_preferences`; no new pref keys for v1.

## 4. One short URL + QR per event

- New short route `src/routes/e.$code.tsx` → resolves a 6-char base32 code and server-redirects to `/g/$slug/e/$eventSlug` (canonical URL preserved for SEO).
- Code stored as `group_events.short_code text unique`, generated on insert via trigger.
- Final URL: `workshopindie.com/e/AB12CD` — short enough for QR v2 at high error correction, prints crisp at 1".
- QR generation: client-side via `qrcode` (~6KB), rendered into a downloadable PNG/SVG inside a "Get the link" sheet alongside copy-link.
- Same code keeps resolving after the event, so flyers and QR codes remain useful as "what happened" pointers.
- Because public works are visible to logged-out visitors, a printed QR works as expected: scan → see the event + what people are bringing, no account required.

## 5. Other places this flow could live (deferred)

Not in v1, listed so we don't forget:

- Group page "Coming up" strip mirroring the event header.
- Workshop room ended state: "Share to the group's next event" CTA.
- DM header chip: "You're both going to {event}".

## 6. 2027 simplicity moves

- **One control, many states.** The RSVP button is the page's only fixed chrome; everything below recomposes around it.
- **Inline social proof, no badges.** Status pills replaced by a single live avatar row that animates a new face in on RSVP via `framer-motion layoutId`. Showcase chips use the same stacked-avatar primitive — one component, two contexts.
- **Public-by-default everywhere.** No blur, no "sign up to see" walls over content the creator opened to the web. Sign-in CTAs sit *next to* content, not *over* it.
- **Print-native.** Short link + QR + a single-line caption ("Workshop · Fri 7pm · workshopindie.com/e/AB12CD") render as a downloadable 1080×1080 share card and a print-ready 4×6 PDF — generated client-side from the same data.

## Technical surface

- **DB migrations:**
  - `group_events.short_code text unique` + before-insert trigger that fills it with a 6-char base32 code (retries on collision).
  - `event_showcase_items` table + RLS + GRANTs per public-schema rules.
- **Server fns:**
  - `getEventByShortCode` (public read via server publishable client; only safe columns).
  - `listEventAttendeeCollabs` / `listEventAttendeeWorks` extended to always filter by the underlying row's visibility; no new flag.
  - `addShowcaseItem`, `removeShowcaseItem`, `listShowcaseItems` (auth, RSVP-checked). `listShowcaseItems` returns rows grouped by `work_id`/`collab_id` with an aggregated `bringers: [{user_id, avatar_url, display_name}]` array so the client renders the stacked-avatar chip directly.
  - `listSuggestedAttendeesForViewer` (auth) for the "Your night" panel.
- **Routes:**
  - `src/routes/e.$code.tsx` (resolves + 308s to canonical URL).
  - `src/routes/api/public/events.digest.ts` (15-min cron, idempotent inserts into `notifications`).
- **Components:**
  - `EventHeaderRsvpStrip`, `EventYourNightPanel`, `EventShareSheet` (QR + copy + print), `EventBringChip` on `WorkCard`/`CollabCard` when `eventContext` prop is set.
  - `StackedBringersChip` — single primitive used for the showcase chip; reused for the live attendee avatar row.
- **No edits** to `src/integrations/supabase/*`. No email templates. No new privacy column.

## Suggested build order

1. Short code + `/e/$code` route + QR/share sheet.
2. Public-first event page layout (logged-out + RSVP'd branches; attendee-work fns honor existing visibility).
3. `event_showcase_items` + inline "Bring this" / "I'm in" affordances + `StackedBringersChip`.
4. Notifications cron + two in-app kinds.
