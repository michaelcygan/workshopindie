# Fix podcast application errors + account checkbox

## What's happening

**1. The raw error toast.** The "Tell us about your process" field requires at least 40 characters on the server. When it's shorter, the server's validation object is dumped into the toast as raw JSON instead of a readable sentence. Nothing tells you about the length requirement before you submit.

**2. The "create Workshop account" checkbox.** It only renders for signed-out visitors. On the live site you were signed in, so it was correctly hidden — but there's no explanation, which reads like a bug. Signed-in applicants should see their account is already linked instead of nothing.

## Changes

### Readable validation
- Convert validation failures into a single plain-English message before showing the toast, so applicants see "Tell us a little more about how you work." instead of JSON.
- Add the same short guidance under the process field ("A few sentences is plenty — at least 40 characters") and a live character hint once typing starts.
- Block submit client-side with a friendly toast when the process answer is too short, so the round-trip isn't needed.
- Scroll to and focus the offending field on error.

### Account checkbox clarity
- Signed out: keep "Also create my Workshop account." (unchanged behavior).
- Signed in: replace the empty gap with a short line — "Applying as @yourhandle — this application will be linked to your Workshop account."
- Also drop the "No account needed." line next to the submit button when signed in, since it contradicts the linked-account state.

## Technical notes

- Files: `src/routes/applypodcast.tsx` (client validation, error formatting, signed-in state), `src/lib/podcast.functions.ts` (unchanged rules; only the client-side surfacing of Zod issues changes).
- Reuse the existing human-readable Zod error helper used by the collab submission flow rather than adding a new one.
- No database or schema changes.
- The live site also needs a republish to pick up the current form.
