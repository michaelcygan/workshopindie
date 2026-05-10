# Workshop — Remaining Build Roadmap

Audit of what ships vs. what's still stubbed, grouped into four focused passes. Each pass is a single message-sized chunk that ends in a usable, demoable surface.

## What's already shipped (passes 1–3)

- Data model + RLS for the entire spec (~20 tables, all enums)
- Design system (Stripe × Partiful), auth, onboarding, top nav
- Works Gallery + Work detail + publish-a-Work
- Profile / Portfolio + edit
- Workshops: schedule → browse → apply → host approve → realtime room → finalize-to-Work with auto-credits

## What's still stubbed

| Surface | Status |
|---|---|
| Collab Board | "Coming soon" placeholder |
| Instant rooms | "Coming soon" placeholder |
| City standing meetups | Tables exist, no UI |
| Workshop check-in window | Not surfaced |
| `/me` dashboard (my workshops, applications, drafts) | Redirects to profile only |
| Comments on Works | Component exists, not mounted |
| Reports / moderation | Tables + RLS, no Report button or admin queue |
| Admin panel | None |
| Founding Creator / city host badges | Enum exists, never shown |
| Notifications | Not started |
| Workshop tools (pinboard, shot list, outline) | Tables exist, not wired |
| Per-route SEO metadata | Generic only |

---

## Pass 4 — Collab Board (full loop)

The third top-level CTA. Same shape as Workshops but for ideas already in motion that need people, no clock.

**Routes & components**
- `/collab` — browse open posts, filter by category + city, sort newest/most-needed
- `/collab/new` — create post: title, description, category, city, timeline text, location mode, compensation type, contact mode (email relay vs external link), roles repeater
- `/collab/$slug` — detail with role list, "I'm interested" button per role, contact CTA, related profiles
- `CollabCard` component matching `WorkshopCard` styling
- Contact event logged to `collab_contact_events` on send (email relay is just a logged event in v1; actual email delivery deferred)

**Auto-publish hook:** if the collab eventually ships a Work, the creator can link `source_collab_post_id` from `/works/new`.

## Pass 5 — Instant (presence + ephemeral chat)

Lightweight always-on rooms. Shows "happening now" energy on the homepage.

**Routes & components**
- `/instant` — grid of rooms by category × city, live presence counts
- `/instant/$id` — room view with presence list + ephemeral 24h messages, realtime via supabase channels
- `/instant/new` — quick spawn (category + optional city + title)
- Heartbeat: client upserts `instant_presence` every 30s, marks `dropped` on unmount
- Background cleanup: messages auto-expire via `expires_at` (already in schema); add a daily server fn to hard-delete expired rows
- Wire homepage "Happening Now" strip to real Instant data

**Workshop spawn:** an Instant room can spawn a 1-hour Workshop in place — sets `workshop_mode = 'instant_spawned'` and migrates participants.

## Pass 6 — Workshop polish + `/me` dashboard + Comments + SEO

Closes the loop on the Workshop product and gives users a home base.

**`/me` dashboard**
- Tabs: Hosting · Applied · Participating · Drafts
- Quick actions per workshop (manage applications, enter room, finalize)
- Inline notifications stub (just badge counts from queries for now)

**Workshop polish**
- Check-in screen during the `check_in_opens_at → check_in_closes_at` window with a big "I'm here" button → flips application + participant to `checked_in`
- Status auto-progression on key actions (open → check_in → active → finalizing → shipped)
- Share modal with copy-link
- Workshop tools (pinboard MVP only): single tool type that participants can post text/links to, scoped to room

**Comments on Works**
- Mount `CommentThread` on `/works/$slug`
- Optimistic post + realtime updates

**SEO**
- Per-route `head()` for `/works/$slug`, `/workshops/$slug`, `/u/$username`, `/collab/$slug`
- Pull og:image from cover_url; structured data (JSON-LD CreativeWork for Works)

## Pass 7 — Trust & Safety + badges + Founding Creator perks

The product can't go live without this layer.

**Reporting**
- "⋯ → Report" menu on Work, Profile, Workshop, Collab post, comment
- Modal with reason picker (spam, harassment, IP, off-topic, other) + free text
- Writes to `reports` table

**Admin (`/admin`, gated by `has_role(uid, 'admin')`)**
- Reports queue (open / reviewed / dismissed / action_taken)
- One-click hide/unhide on reported entity
- City + category management
- Ability to grant Founding Creator / city host / verified creator badges

**Badges everywhere**
- Small chip next to display name on Profile, Work credits, Workshop host card
- Founding Creator gets a subtle gradient badge

**Notifications (lightweight, no separate table needed for v1)**
- Derived feed from queries: unanswered applications you sent, new applications on workshops you host, workshops starting in <1h
- Bell in top nav with count + popover list

---

## Order of execution

1. **Pass 4 — Collab Board** (highest spec coverage gap, mirrors Workshops so it's fast)
2. **Pass 5 — Instant** (the third pillar, makes the homepage feel alive)
3. **Pass 6 — Polish** (`/me`, check-in, comments, SEO — turns it into a real product)
4. **Pass 7 — Trust & Safety** (admin + reports + badges — required before publishing)

## Explicitly out of scope (won't be built)

Per your original spec — keeping the product focused:
- Native video / audio / call hosting
- Payments, contracts, escrow
- Complex rights / licensing systems beyond the four enum options
- Project-management features (tasks, gantt, time tracking)
- Mobile native apps

---

Approve and I'll start with **Pass 4 — Collab Board**, or pick a different starting point.
