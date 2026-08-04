# Fix the "Profile not found" crash on /u/$username

## What's actually wrong

The profile at `@michaelcygan` exists in the database. The page fails because the profile query is denied at the database column level, and the page shows "Profile not found" for *any* failure — including permission errors.

Two separate column-permission gaps confirmed by inspecting the live grants on `profiles`:

- Signed-in visitors: the `languages` column is **not** readable by signed-in users. The profile page always asks for it, so every profile load fails for a logged-in member.
- Logged-out visitors: the `home_city_id` column is **not** readable by anonymous visitors, and the page joins the home city on every load, so logged-out profile loads fail too.

Because the page treats "query failed" and "no such profile" identically, both cases render the same misleading dead-end screen. The button on that screen also says "Back to gallery" but actually navigates to the homepage, and it ignores where the visitor came from (a blog post, in this case).

## The fix

### 1. Restore the missing read permissions

One migration granting the missing per-column reads:

- `languages` readable by signed-in members.
- `home_city_id` readable by anonymous visitors (matching the existing `city_id` grant).

No policy changes; row-level rules stay exactly as they are. Nothing new becomes public that isn't already public (city and languages are already displayed on public profiles).

### 2. Stop failures masquerading as "not found"

In `src/routes/u.$username.tsx`:

- Separate the two states: a genuine missing handle keeps the "Profile not found" screen; a failed request shows a "Couldn't load this profile / Try again" state with a retry that refetches.
- Make the profile query retry once on transient failure.

### 3. Fix the dead-end button

- Replace "Back to gallery" (which links to `/`) with a correct pair: **Go back** (browser history, so returning to the blog post works) and **Browse Gallery** linking to `/gallery`.
- Align the route-level `notFoundComponent` copy with the in-page one.

### 4. Audit the "go to your profile" path

Verify and, where needed, harden the chain used by every profile entry point:

- `/me` → looks up `username` + `onboarded` → redirects to `/u/$username`. Confirm the columns it reads are permitted for signed-in users (they are) and that a failed lookup shows a retry rather than bouncing to onboarding.
- Entry points reviewed for correct destination: blog article footer, site footer, notifications menu, checkout return, redeem, claim, work-invite pages.

## Technical notes

- Files touched: one new SQL migration; `src/routes/u.$username.tsx`; `src/routes/me.index.tsx` (error handling only); minor copy in `src/components/blog-article-footer.tsx` if the label needs to match.
- No changes to profile data shape, RLS policies, or what data is exposed.
- Verification: query the profile page as both an anonymous and a signed-in session against the same handle and confirm it renders instead of falling through to the not-found screen.
