# Fix the "Something didn't load" crash when opening Sign in

## What's happening

React error #300 means "Rendered fewer hooks than expected." Confirmed cause: the site footer component (`src/components/site-footer.tsx`) bails out early — before it has set up the rest of its internal state — whenever the current page is one of the hidden-footer pages (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/onboarding`, `/checkout`, `/dms`, `/admin`, and a few others).

On a normal page the footer sets up 5 pieces of internal state. When you navigate to `/login`, it exits after the first one, and React tears the whole page down with the error screen. Clicking "Try again" remounts everything from scratch, so it works the second time — exactly the behavior you described. This also explains why the same crash appears when hitting other pages in that list (DMs, onboarding, admin, checkout).

## The fix

Restructure the footer so all of its internal setup happens first and the "hide this footer" decision happens last, right before rendering. No visual or behavioral change: the footer still doesn't render on those routes.

## Technical detail

In `src/components/site-footer.tsx`, move `if (shouldHide(pathname)) return null;` (line 41) to after all hook calls — below `useAuth`, `useServerFn`, and the three `useState` calls — immediately before the JSX `return`. The `onSubscribe` handler definition stays above it.

## Verification

- Load the homepage in the mobile preview, click "Sign in", and confirm `/login` renders without the error screen.
- Repeat for `/signup` and `/dms` (same hidden-footer list).
- Confirm the footer is still absent on those routes and still present on `/`, `/blog`, `/groups`.
