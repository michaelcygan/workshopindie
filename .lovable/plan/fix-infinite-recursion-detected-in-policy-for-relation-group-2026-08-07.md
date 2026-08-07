# Fix: "infinite recursion detected in policy for relation group_members"

Joining a group fails for signed-in members. The cause is confirmed in the database access rules, not in the UI code.

## What's happening

- The rule that lets you join a group checks the `groups` table (is it open, not deleted?).
- The rule that lets you see unlisted groups checks the `group_members` table (are you a member?).

Each rule triggers the other, so the database loops and aborts with the recursion error. Any join on any group hits this.

## The fix

Break the loop by moving both lookups into small trusted database helper functions that skip re-running the access rules.

1. Add `public.group_is_joinable(_group_id uuid)` — security definer, returns true when the group exists, is not deleted, and its join mode is open.
2. Add `public.is_group_member(_user_id uuid, _group_id uuid)` — security definer, returns whether a membership row exists.
3. Recreate the join rule on `group_members` to use `group_is_joinable(group_id)` instead of a direct `groups` subquery, keeping the same conditions (you may only add yourself, only as a plain member).
4. Recreate the unlisted-group visibility rule on `groups` to use `is_group_member(auth.uid(), id)` instead of a direct `group_members` subquery.

No change to who can do what — the same people can join and see the same groups; only the mechanics change.

## Technical notes

- Both functions: `language sql`, `stable`, `security definer`, `set search_path = public`, and `execute` revoked from `public`/`anon` where not needed (`authenticated` only).
- Delivered as one migration; policies dropped and recreated in the same migration.
- After applying, verify by inserting a membership row as a signed-in user and running the database linter.
