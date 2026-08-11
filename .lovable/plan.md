# Grant admin to mcygan3@gmail.com

The account `greenhousecrtv@gmail.com` (@mike) has one privilege row: `admin` in `public.user_roles`. It has no blog-writer or Plus grant rows, so admin is the whole difference. `mcygan3@gmail.com` (@michaelcygan) currently has no role rows.

## Change

One migration that inserts an `admin` role row for `mcygan3@gmail.com`:

- Look up the user id by email from `auth.users` inside the migration so no id is hardcoded incorrectly.
- Insert into `public.user_roles (user_id, role)` with `on conflict do nothing`, so re-running is safe.

No schema, policy, or app code changes — every admin gate already reads `has_role(auth.uid(), 'admin')`.

## Verify

After the migration, re-query `user_roles` for both accounts and confirm both show `admin`.
