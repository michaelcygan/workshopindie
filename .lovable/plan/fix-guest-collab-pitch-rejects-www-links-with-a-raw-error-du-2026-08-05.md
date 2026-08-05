# Fix: guest Collab pitch rejects "www." links with a raw error dump

## What happened

The pitch was typed with a bare link — `www.michaelcygan.com`, no `https://`. The
demo reel field only accepts fully-qualified links, so the submission was
rejected. Worse, the rejection surfaced as raw validation JSON
(`[{ "code": "invalid_format", "path": ["reelUrl"] ... }]`) instead of a human
sentence, so there was no way to tell what to fix.

The project already has a URL normalizer (used by the Work publishing flow) that
turns `www.example.com` into `https://www.example.com`. The guest pitch form
never wired it up.

## The fix

1. **Accept bare links.** Normalize the demo reel and portfolio fields the same
   way the rest of the app does: add `https://` when the scheme is missing, both
   as the field loses focus and again on the server before validation. Typing
   `www.michaelcygan.com` just works.
2. **Human error messages.** Field errors become plain sentences shown next to
   the offending field ("That demo reel link doesn't look like a web address"),
   and the toast never prints raw validation JSON again.
3. **Same treatment for the signed-in application path**, so both routes into a
   Collab behave identically.

## Technical notes

- `src/components/guest-apply-dialog.tsx`: apply `normalizeUrlOrKeep` from
  `@/lib/url-normalize` on blur for `reelUrl` and `portfolioUrl`; normalize again
  in `onSubmit` before calling the server fn.
- `src/lib/collab.functions.ts`: change `httpsUrl` to preprocess with the shared
  normalizer before `.url()`, and give each optional URL/handle field an explicit
  `message`. Keep the 500-char cap and http/https-only restriction.
- Add a shared error formatter that maps a ZodError to `issues[0].message`
  (prefixed by a friendly field label) so thrown server errors are already
  readable; the dialog's catch block keeps showing `err.message`.
- Check the other consumer of `httpsUrl` in `collab.functions.ts` (signed-in
  application) and route it through the same normalization.
