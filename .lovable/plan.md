# Pass 2 — Stickiness & Retention

Four focused additions. No destructive changes; everything is additive and dismissible.

## 1. Universal Share Sheet

Generalize `src/components/share-collab-sheet.tsx` → `src/components/share-sheet.tsx`:
- Props: `entity: { type: 'collab'|'work'|'workshop'|'profile', id, url, title, subtitle? }`
- Channels: Copy link, X/Twitter, Facebook, WhatsApp, Email, Native share (if `navigator.share`)
- Append `?ref=<current-username>` to URL when signed in (powers referral attribution in step 3)
- Log every share to `share_events` table

Wire share buttons into:
- `src/routes/w.$slug.tsx` (works) — replace/augment existing share affordance
- `src/routes/workshop.$id.tsx` (workshops) — add to header
- `src/routes/u.$username.tsx` (profiles) — add next to follow button
- Keep existing collab sheet usage working via re-export

**DB migration:** create `share_events` table (entity_type, entity_id, channel, user_id nullable, created_at) with RLS: anyone inserts, owner reads own entity's shares.

## 2. Profile Completion Chip

New component `src/components/profile-completion-chip.tsx` rendered on `/me`:
- Checks: avatar set, home city set, ≥1 published work, bio non-empty
- Shows "Profile 2/4 — finish" pill with progress dots, dismissible (localStorage)
- Click → scrolls to first missing field on `/me/edit` (or `/works/new` for the work step)
- Hidden when 4/4 complete or dismissed

Pure frontend; no schema change.

## 3. Referral Attribution

- Add `referred_by uuid` column to `profiles` (nullable, references profile id)
- On `/signup` route: read `?ref=<username>`, store in sessionStorage
- After successful signup, look up profile by username and set `referred_by` on new profile
- Trigger fires `referral_joined` notification to the referrer ("@newuser joined via your link")
- Notification routes to `/u/$newusername`

**DB migration:** add column + trigger.

## 4. "Just Shipped" Celebration

When a user publishes their **first** Work (no prior `published_at`):
- DB trigger on `works` table: on insert with `published_at` not null, count user's prior published works; if 0, fire:
  - `first_work_shipped` notification to all followers ("@user just shipped their first Work: <title>")
  - Auto-DM (via `conversations`/`messages`) to each credited collaborator: "Thanks for collaborating on <title> — it's live!"
- Notification routes to `/w/$slug`

For subsequent works: fire `work_published` notification to followers only (no DMs). Dedupe via `entity_id`.

**DB migration:** trigger + helper function.

## Files

**Create:**
- `src/components/share-sheet.tsx` (generalized)
- `src/components/profile-completion-chip.tsx`

**Modify:**
- `src/routes/w.$slug.tsx`, `src/routes/workshop.$id.tsx`, `src/routes/u.$username.tsx` (mount share sheet)
- `src/routes/me.index.tsx` (mount completion chip)
- `src/routes/signup.tsx` (capture `?ref`, attribute on signup)
- `src/components/notifications-bell.tsx` (route new notification kinds)
- `src/components/share-collab-sheet.tsx` (re-export wrapper, keep current callsites working)

**Migrations:**
- `share_events` table + RLS + grants
- `profiles.referred_by` column
- Triggers: referral_joined, first_work_shipped / work_published

## Out of Scope (per earlier decision)
No referral rewards, no email digests, no push notifications, no comments/reactions changes.

Ready to ship on approval.