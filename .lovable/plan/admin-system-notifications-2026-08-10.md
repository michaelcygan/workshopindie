# Admin system notifications

Extend the admin bell beyond podcast applications so you get a light, useful pulse of what's happening on Workshop.

## What you'll get pinged for

One notification per event, delivered to every admin:

- **New member joined** — name/username, city and field if set.
- **New blog post published** — title and author.
- **New Work published** — title, author, field.
- **New Collab posted** — title, author, field.
- **Growth milestones** — member count crossing 50, 100, 250, 500, 1000, 2500, 5000, 10000; and the 10th / 50th / 100th / 500th published Work, Collab, and blog post. One ping per threshold, ever.

Each notification links to the relevant page: the member's profile, the post, the Work, the Collab, or `/admin/growth` for milestones.

## How it works

Rather than wiring each app code path (there are several ways a Work or post can get published), the pings are generated in the database so nothing can slip through.

1. A shared SQL helper `public.notify_admins(kind, entity_type, entity_id, payload)` inserts one `notifications` row per user in `user_roles` with role `admin`. Security definer, `search_path = public`, no public execute grant.
2. Triggers, each written to never block the underlying write:
   - `profiles` AFTER INSERT → `admin_new_member`
   - `blog_posts` AFTER INSERT/UPDATE, when status becomes `published` and it wasn't before → `admin_blog_published`
   - `works` AFTER INSERT/UPDATE, on transition into `status = 'published'` → `admin_work_published`
   - `collab_posts` AFTER INSERT, when status is `open` → `admin_collab_posted`
3. Milestones: a small `admin_milestones` table (key text primary key, reached_at) guards one-time delivery. After each of the above triggers fires, the helper checks the relevant count against the threshold list and, if a new threshold is crossed and not yet recorded, inserts the key and emits `admin_milestone`.

Existing member-facing kinds (`work_published`, `first_work_shipped`, etc.) are untouched; these are new admin-only kinds so your bell and members' bells stay separate.

## Front-end

`src/components/notifications-bell.tsx` gains icons and labels for the five new kinds:

- `admin_new_member` → UserPlus, links to `/{username}`
- `admin_blog_published` → FileText, links to the post
- `admin_work_published` → Sparkles, links to the Work
- `admin_collab_posted` → Users, links to the Collab
- `admin_milestone` → TrendingUp, links to `/admin/growth`

Hrefs are built with the existing `workshopEntityUrl` helper so they follow current URL conventions.

## Notes

- Volume stays low by design: signups and publishes are the only per-event pings, and milestones fire once per threshold.
- If any of these later get noisy, they can be muted per-admin through the existing `notification_preferences` pattern — not included in this pass.
