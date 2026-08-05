# Fix: new accounts can't be created (Apple, Google, or email)

## What's happening

No account was created. Sign-in with Apple got as far as the identity check, then the backend failed with a 500 and the browser fell back to the logged-out homepage.

The auth log for your attempt shows the real cause:

```text
new row for relation "profiles" violates check constraint "profiles_dm_policy_check"
```

When a brand-new user is created, the app automatically creates their profile row. That row sets the "who can DM me" preference to the default value **mutuals**. But the database rule on that column was never updated when "mutuals" was introduced — it still only permits **everyone** or **nobody**. So the profile insert is rejected, the whole signup transaction rolls back, and no user is saved.

Confirmed in the live database:
- `profiles.dm_policy` default is `'mutuals'`
- the check constraint allows only `('everyone','nobody')`
- every existing profile is `'everyone'`, so no old data conflicts

This affects **all** signup methods, not just Apple. It is not an Apple or Google configuration problem.

## The fix

One database migration:

1. Drop `profiles_dm_policy_check` and recreate it as `CHECK (dm_policy IN ('mutuals','everyone','nobody'))` — matching the three options already offered in Settings and typed in `src/lib/account.functions.ts` / `src/routes/settings.tsx`.

No app code changes are needed; the frontend already speaks all three values.

## Verification

- Create a test account end-to-end and confirm the row lands in the users table and the profile is created with `dm_policy = 'mutuals'`.
- Confirm the DM privacy selector in Settings can still switch between all three options and persists.
- Confirm Apple and Google sign-in complete into the logged-in flow rather than bouncing to the homepage.
