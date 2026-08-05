# Fix: public Collab pages show "Not found."

## What's happening

Opening `workshopindie.com/collab/experimental-edm-track-collaboration` while signed out shows "Not found." The Collab itself is fine — it's public, not archived, not published (verified in the database).

The page fails because of a permissions detail: the Collab page loads the host's profile fields alongside the Collab, and one of those fields (the host's first name) is readable by signed-in visitors only. For a signed-out visitor the whole request is rejected, so the page has no Collab data and falls back to its "Not found." message. Anyone opening a shared Collab link — from a profile, Instagram bio, or a DM — hits this.

## The fix

1. Allow signed-out visitors to read the host's first name, the same field already displayed publicly on the Collab page to signed-in visitors. No other profile fields change.
2. Make the Collab page honest about failures: when the data request errors, show a real error state with a retry, instead of silently claiming "Not found." Genuine missing/archived Collabs keep the existing "Not found" screen.

## Technical notes

- Migration: `GRANT SELECT (first_name) ON public.profiles TO anon;` — column-level grant only; RLS policies stay untouched.
- `src/routes/collab.$slug.tsx`: the `["collab", slug]` query currently collapses `isError` into the `!post` branch. Split them — render an error state (message + retry) when `isError`, and keep "Not found." only for a successful query returning `null`.
- Verify signed-out with the deployed anon key that the Collab detail query returns the row.
