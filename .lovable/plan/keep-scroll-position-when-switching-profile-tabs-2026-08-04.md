# Keep scroll position when switching profile tabs

## What's happening

Switching tabs on a profile (`Works / Blog / Collabs / About`) is a router navigation: it writes `?tab=...` into the URL. The router is configured with scroll restoration on, so every navigation — including these same-page tab changes — jumps the window back to the top. That's why each tab click re-throws you to the top of the profile.

## The fix

Tell the router not to reset scroll for these same-page tab navigations.

- In `src/routes/u.$username.tsx`, `setTab()` calls `navigate({ ... , replace: true })` — add `resetScroll: false`.
- The stat pills below the header (`Gallery`, `Worked with`, `Followers`, `Following`, `Posts`) are `<Link>`s that also set `?tab=`; add `resetScroll={false}` to them too so they behave consistently.
- Same treatment for the in-page blog links that navigate to `{ tab: "blog", post: slug }`, so opening a post from the profile doesn't yank the page.

## Result

The tab bar (already sticky) stays where it is, content below swaps, and your scroll position is preserved. Deep links arriving from elsewhere still land normally at the top of the profile.

## Technical notes

- No changes to router config; `scrollRestoration: true` stays global and only these intra-profile navigations opt out via `resetScroll: false`.
- Purely presentational/navigation change — no data, query, or layout changes.
