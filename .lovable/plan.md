# Settings hub

Right now there's no `/settings` route. "Blocked users" sits in the avatar dropdown, "Workshops age filter" is buried in the profile edit flow, and there's no Plus management surface other than the pricing page. This consolidates account-level controls into a single Settings page and keeps `/me/edit` focused on profile content.

## Mental model

- **`/me/edit` — Profile edit.** Public identity: name, handle, avatar, headline, bio, mediums, location, links, pinned works. *What other people see.*
- **`/settings` — Account settings.** Private controls: account, membership, privacy, notifications, safety, data. *How the platform behaves for you.*

## Information architecture

Settings is one route (`/settings`) with a left-rail TOC and stacked sections — same pattern as `me.edit.tsx`. Sections:

1. **Account**
   - Email (display + "Change email" → Supabase update flow)
   - Password ("Change password" → reset link)
   - Date of birth (read-only once set; controls 18+/21+ filters)
   - Sign out

2. **Plus membership** *(conditional on Plus status)*
   - **Free user:** small upsell card → "Go Plus" → `/pricing`
   - **Active Plus:** plan name, renewal date, "Manage billing" → calls existing `createPortalSession` and opens Stripe portal in new tab
   - **Canceled (grace period):** show "Access until {current_period_end}" + "Resume" link to `/pricing`

3. **Privacy** *(moved out of `/me/edit`)*
   - **Workshops age filter** (existing `profiles.age_filter_min`) — move from profile edit, leave a link breadcrumb the first time it's missing
   - **Who can DM me** — `everyone | following_only | nobody` *(new column `profiles.dm_policy`)*
   - **Who can tag me as a credit** — `everyone | following_only` *(new `profiles.credit_policy`)* — tag still creates the credit but requires approval when not "everyone"
   - **Show me in city/local creator lists** — `boolean` *(new `profiles.discoverable`)* — when off, profile still works at `/u/{username}` but is hidden from Local creators, search, and "people you may know"
   - **Search engine indexing** — `boolean` *(new `profiles.indexable`)* — when off, profile route emits `<meta name="robots" content="noindex">`

4. **Notifications** *(new `notification_preferences` table)*
   - Per-channel (email / in-app) toggles for: follows, comments, mentions, DMs, collab applications, workshop reminders, weekly digest
   - Sensible defaults seeded on first save

5. **Safety**
   - **Blocked users** — full list with Unblock buttons (move content from `/me/blocked` into this section; `/me/blocked` keeps redirecting to `/settings#blocked` for back-compat)
   - **Report history** — read-only list of reports you've submitted with their status

6. **Data & account**
   - **Download my data** — server fn that bundles profile + works + collab posts JSON and returns a download
   - **Delete my account** — destructive flow with typed confirmation; soft-deletes profile, anonymizes credits, hard-deletes auth user via admin client in a server fn

## Navigation changes

- `top-nav.tsx` dropdown: remove standalone "Blocked users", add "Settings" (gear icon) between "Refer & Earn" and "Sign out". Keep "Go Plus" as a quick action for non-Plus users; for Plus users it already says "Manage Plus" — point it to `/settings#plus` instead of `/pricing`.
- `me.edit.tsx`: remove the Privacy section and its TOC entry. Add a small "Privacy & notifications live in Settings →" link at the bottom.

## Technical details

### Migration
```text
ALTER TABLE profiles ADD COLUMN
  dm_policy text NOT NULL DEFAULT 'everyone'
    CHECK (dm_policy IN ('everyone','following_only','nobody')),
  credit_policy text NOT NULL DEFAULT 'everyone'
    CHECK (credit_policy IN ('everyone','following_only')),
  discoverable boolean NOT NULL DEFAULT true,
  indexable boolean NOT NULL DEFAULT true,
  deleted_at timestamptz;

CREATE TABLE notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { follows: true, comments: true, ... }
  in_app jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- GRANTs + RLS: owner-only select/insert/update
```

RLS hardening:
- Add `discoverable = true` filter to local-creator / search queries (server-side; user themself always sees themself).
- Update `messages` insert policy + `tg_messages_dm_policy` trigger to enforce `dm_policy` (nobody → reject; following_only → require recipient follows sender).

### Routes
- `src/routes/settings.tsx` — new, under `_authenticated` if that layout exists, else gated in `beforeLoad`
- `src/routes/me.blocked.tsx` — replace body with `<Navigate to="/settings" hash="blocked" />`

### Components
- Reuse the TOC + Section pattern from `me.edit.tsx`
- `PlusManagementCard` — wraps `usePlus()` + `createPortalSession`
- `BlockedUsersList` — extracted from current `me.blocked.tsx`
- `DeleteAccountDialog` — typed-confirmation, calls new `deleteMyAccount` server fn

### Out of scope (call out, don't build)
- Two-factor auth (requires Supabase MFA enrollment UI; bigger lift)
- Login session list / "Sign out other devices"
- Per-device push notifications

## Files

**New:** `src/routes/settings.tsx`, `src/components/settings/plus-card.tsx`, `src/components/settings/blocked-users-list.tsx`, `src/components/settings/delete-account-dialog.tsx`, `src/lib/account.functions.ts` (export data, delete account), `src/lib/notifications-prefs.functions.ts`, migration file.

**Edited:** `src/components/top-nav.tsx` (dropdown), `src/routes/me.edit.tsx` (remove Privacy section), `src/routes/me.blocked.tsx` (redirect), feed queries that need `discoverable` filter (`cities.$slug.tsx`, network/search functions).
