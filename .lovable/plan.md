Wave 6 is complete.

I verified the repo-wide audit: no stale "30 minutes/day" or "priority seat" product copy remains, and the deprecated `FREE_PORTFOLIO_CAP` alias has been removed from `src/lib/entitlements.ts` and `src/hooks/use-plus.tsx`.

Wave 7: Server-side quota hardening for Works and Collabs

The remaining gap is that the Free/Plus limits for Works and Collabs are only enforced client-side. The RLS policies on `public.works` and `public.collab_posts` allow authenticated users to insert and update their own rows, and the creation routes (`works.new.tsx`, `collab.new.tsx`, `workshops.$slug.tsx`) do the cap check in the browser. A user could bypass the gate by calling the Supabase client directly.

The fix is to move the enforcement into the database and server functions, while keeping the existing PlusGate UI for the normal flow.

What I will build:

1. Database triggers (authoritative enforcement)
   - Add a `BEFORE INSERT OR UPDATE` trigger on `public.works` that rejects setting `status = 'published'` when the user is on the Free tier and already has `FREE_PUBLISHED_WORK_CAP` published works.
   - Add a `BEFORE INSERT OR UPDATE` trigger on `public.collab_posts` that rejects setting `status = 'open'` when the user is on the Free tier and already has `FREE_OPEN_COLLAB_CAP` open collabs.
   - Both triggers use a `SECURITY DEFINER` helper that reads the user's tier from `public.subscriptions`, so the check is authoritative and cannot be bypassed via RLS.
   - Exceptions are raised with a clear message like `Free tier work limit reached` / `Free tier collab limit reached` so the client can show the right upsell.

2. Server-function hardening
   - Add the same quota pre-check inside `publishWorkFromCollab` in `src/lib/collab-publish.functions.ts` before inserting the Work, so the server function returns a structured `quota` error rather than a raw Postgres exception.

3. Client error handling
   - Update `works.new.tsx`, `collab.new.tsx`, and `workshops.$slug.tsx` to detect the trigger/server quota error and open the `PlusGate` instead of surfacing a generic database error toast.

4. Verification
   - Run `bunx tsc --noEmit` and `bun run build` to confirm the changes compile cleanly.

This makes the Free/Plus limits for Works and Collabs as robust as the existing Lounge-minute and Blog-publication limits (which are already enforced by RPCs/triggers).