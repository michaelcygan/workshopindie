# Fix Google sign-in: the provider is switched off on the backend

## What's happening

Your friend never created an account. Nothing was saved.

The backend has exactly three accounts, the newest from June 13 — no new user was
created tonight, and the auth service recorded no sign-in attempts at all.

I tested the live sign-in path on workshopindie.com directly. The hand-off to
Lovable works, but the backend rejects the Google step with:

```text
Unsupported provider: missing OAuth secret
```

Google sign-in is currently not configured on the project's auth settings, so
the flow dies at the provider hand-off and the browser is sent back to the
logged-out homepage with no error shown. That matches exactly what he saw.
Email/password signup is unaffected.

## The fix

1. **Re-enable managed Google sign-in.** Reconfigure the Google provider so it
   uses Lovable's managed OAuth credentials again. This is a settings change, no
   code involved, and it fixes the loop for everyone.
2. **Verify.** Re-run the same live probe against the auth endpoint and confirm
   it now returns a redirect to Google instead of a 400, and check the sign-in
   button on the published site.
3. **Stop silent failures.** Today a failed OAuth return just lands on the
   homepage with no message. Add a small handler that reads the `error` /
   `error_description` returned on the landing URL and shows a toast plus a
   "try again" prompt, so a broken provider is visible instead of looking like
   nothing happened.

## Technical notes

- Root cause confirmed by `GET /auth/v1/authorize?provider=google` returning
  `400 validation_failed — missing OAuth secret`; the `/~oauth/initiate` proxy
  and the redirect allow-list (both apex and www) are correct.
- Step 1 uses the social-login configuration tool with `providers: ["google"]`;
  email stays enabled.
- Step 3 is a small client-side effect in the root component that strips the
  error params from the URL after surfacing them, touching only presentation.

## After the fix

Ask your friend to try again — his Google account will create a fresh Workshop
account and drop him into onboarding.
