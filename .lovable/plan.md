# Collab → Work flow audit + simplification

## What I found

**Good news — there is no auto-publish anywhere.**
Publishing always requires the owner to open the `PublishFromCollabSheet` and confirm. `publishWorkFromCollab` (server fn) is only ever called from that sheet. Consent is intact.

**The real gaps:**

1. **Deadlines are silent.** `ends_on` is only used to *hide* expired posts from the public Collab Board (`collab.index.tsx:52`). When a deadline passes, the post stays `status='open'` in the DB, the owner is never told, and nothing prompts them to close, extend, or publish.
2. **The "Publish Work" nudge only appears after manual close.** `ClosedCollabNudges` (on `/u/$username`) filters `status='closed' AND resulting_work_id IS NULL AND close_nudge_dismissed_at IS NULL`. Owners who never close a post never see the nudge — so the wrap-up flow is invisible to most users.
3. **There is no Collab menu.** A user's collabs are scattered:
   - Hosting (open only) → buried in the `collabs` tab on their own profile
   - Hosting (closed, needs wrap-up) → mixed into the public profile as a banner
   - Hosting (closed, already published) → nowhere
   - Applied to → nowhere (members can only retrace via DMs; guests get nothing)
   - Live workshop attached → only visible on the collab detail page
4. **Top-nav dropdown** has "Post a Collab" but no "My Collabs."

## Plan

### 1. New route: `/me/collabs` — single hub for everything collab

One page, three tabs, no new tables.

```text
/me/collabs
 ├── Hosting          status='open'  (with deadline state badges)
 ├── Wrap up          status='closed' AND resulting_work_id IS NULL
 └── Published        resulting_work_id IS NOT NULL  → link to the Work
        + Applied     collabs you've contacted (joined from collab_contact_events)
```

- Each row shows: title, category chip, deadline state, applicant count (hosting), live-workshop indicator, primary action.
- Primary actions per state:
  - **Open, deadline future** → "View / Manage"
  - **Open, deadline today/past** → "Wrap up" (opens a small dialog: *Extend deadline* · *Close without publishing* · *Publish a Work*)
  - **Closed, no work** → "Publish Work" (opens existing `PublishFromCollabSheet`) or "Dismiss"
  - **Published** → "Open Work"
  - **Applied** → "Open collab" (+ small status: open / closed / published)

### 2. Deadline-reached nudge (consent-only, no auto anything)

- On `/collab/$slug`: when viewer is the owner and `ends_on < today` and `status='open'`, show an inline banner above the post: *"Your deadline passed N days ago. What's next?"* with three buttons — **Extend** (date picker), **Close** (existing `closeCollab`), **Publish Work** (existing sheet). Nothing happens automatically.
- On `/me/collabs` Hosting tab: same row badge ("Deadline passed") with the same three actions inline. Surface a small count chip next to "Hosting" so it's discoverable.
- **No cron sweep, no auto-close, no auto-publish.** All transitions stay user-initiated.

### 3. Surface the hub

- Add **"My Collabs"** to the avatar dropdown in `src/components/top-nav.tsx`, between "My profile" and "Post a Collab," with a small count badge when there's a deadline-passed or wrap-up item waiting.
- Add the same entry to `src/components/mobile-nav.tsx`.

### 4. Clean up the public profile

- Remove `ClosedCollabNudges` from `/u/$username` (it's owner-only chrome leaking into a public page). The wrap-up flow lives in `/me/collabs` now.
- Keep the public `collabs` tab on the profile — it's a portfolio signal ("here's what they're trying to make"), unchanged.

## Technical notes

- **No DB migration.** Everything reads existing columns: `collab_posts.status`, `ends_on`, `closed_at`, `resulting_work_id`, `close_nudge_dismissed_at`, `live_workshop_id`, plus `collab_contact_events.sender_user_id` for the Applied list.
- **One new server fn** in `src/lib/collab-publish.functions.ts`: `extendCollabDeadline({ collabPostId, endsOn })` — validates the user owns the post, future date, updates `ends_on`. (We could also let users edit in the existing post editor, but a one-tap extend from the nudge keeps the loop tight.)
- **One new file:** `src/routes/me.collabs.tsx`. Reuses `CollabCard` for some rows and a compact row component for the tabbed lists. Reuses `PublishFromCollabSheet` and `closeCollab` / `reopenCollab` / `dismissPublishNudge` as-is.
- **No changes** to: the publish flow itself, the public Collab Board, RLS, or notification schema.

## Out of scope

- Email/in-app reminders before deadline (can layer on later via the existing `notification_preferences` table).
- Auto-archiving long-stale collabs.
- Changes to how applicants are managed (`ApplicantsPanel` stays where it is on `/collab/$slug`).
