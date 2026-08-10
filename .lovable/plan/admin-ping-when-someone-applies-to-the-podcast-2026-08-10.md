# Admin ping when someone applies to the podcast

When a new podcast application comes in, every Workshop admin gets an in-app notification in the bell, linking straight to the review queue.

## What you'll see

- Bell notification: "New podcast application — {Name}" with a subtitle like "{Field} · {City}".
- Tapping it opens `/admin/podcast`.
- Only admins receive it. Guests and normal members see nothing new.
- Repeat submissions each create their own notification (one per application, no collapsing across different applicants).

## How it works

- On successful application insert, the submit flow looks up all users with the admin role and delivers one notification to each through the existing notification service (the same path used for follows, collab activity, and event notices).
- The notification is system-generated (no actor), so it isn't muted by an existing preference toggle and isn't affected by block filtering.
- Notification delivery never throws: if it fails, the application is still saved and the applicant still sees the success screen.

## Technical notes

- `src/lib/podcast.functions.ts` (`submitPodcastApplication`): change the insert to return the new row id, then call `notifyMany` from `@/lib/notifications/deliver.server` (dynamic import inside the handler, same pattern as the moderation and newsletter imports).
  - Recipients: `user_roles` where `role = 'admin'` via `supabaseAdmin`.
  - `kind: "podcast_application_new"`, `entityType: "podcast_application"`, `entityId: <new id>`, `payload: { name, field, city }`, no `preference`, `dedupeWindowS: 0`.
  - Wrapped so a failure can't break submission.
- `src/components/notifications-bell.tsx`: add a case for `podcast_application_new` returning title/subtitle and `href: "/admin/podcast"`, plus an icon entry in the `ICONS` map (Mic).
- No database schema or migration changes; `notifications.kind` is a free-form text kind.

## Not included

- Email alerts for new applications (in-app only).
