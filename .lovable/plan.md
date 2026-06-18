# Grant admin role to greenhousecrtv@gmail.com

## What

Insert a row into `public.user_roles` granting the `admin` role to the auth user whose email is `greenhousecrtv@gmail.com`.

## How

Single migration that looks up the user id from `auth.users` by email and upserts into `user_roles`:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE lower(email) = 'greenhousecrtv@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

## After running

- Sign out and back in (or hard refresh) so `useUserRoles` re-fetches.
- Admin tab/links (`/admin`, `/admin/links`, etc.) will appear and be reachable.

## Note

If that email has never signed up in this project yet, the insert will be a no-op (no matching row in `auth.users`). In that case: sign up once with that email, then re-run.

## Out of scope

No UI/code changes. No badge/visual changes elsewhere.
