# Make workshopindie.com/username the canonical creator URL

Today profiles live at `/u/username`. This migration makes the short root URL the real one, keeps every old link working, and protects Workshop's own route words from being claimed as usernames.

## What I confirmed in the current code and data

- The profile page is one large route file, `src/routes/u.$username.tsx`, with search params `tab`, `post`, `story`, an SEO loader, canonical/OG/JSON-LD built from `https://workshopindie.com/u/${username}`, plus its own error and not-found screens.
- Profile links appear in ~40 places across routes and components (`to="/u/$username"` and hand-built `/u/${username}` strings), plus the sitemap, blog JSON-LD, notifications, Profile Peek, and Edit Profile's link-in-bio.
- Usernames are written straight from the Edit Profile form (`supabase.from("profiles").update({ username })`) and auto-minted server-side in `claimAutoUsername`. There is no reserved-word check anywhere today.
- Database: `username` has a plain UNIQUE constraint. 4 profiles currently have usernames, **zero collisions** with the reserved list, no uppercase handles, no case-insensitive duplicates. So the migration can proceed with no account renames.

## Wave 1 — One username namespace module

New `src/lib/usernames.ts`:
- `normalizeUsername()` — lowercase, strip anything outside `a-z0-9_-` (matches today's input behavior).
- `RESERVED_USERNAMES` — derived from the actual root route tree (`admin, api, auth, blog, checkout, cities, claim, collab, dms, e, events, forgot-password, g, gallery, goodbye, groups, index, login, lounge, mcp, me, onboarding, pricing, redeem, refer, reset-password, settings, signup, sitemap, u, w, works, workshops`) plus a short future-proofing set (`about, account, careers, contact, discover, explore, feed, help, home, legal, messages, notifications, press, privacy, profile, search, security, shop, store, support, terms, workshop, workshopindie`) and reserved single letters used as namespaces.
- `validateUsername()` returning one of: valid / too short / invalid characters / reserved.
- `profilePath(username)` → `/${username}` and `profileUrl(username)` → `https://workshopindie.com/${username}`.
- A unit test asserting every root route segment in `src/routeTree.gen.ts` is present in the reserved set, so future routes can't silently collide.

**Authoritative enforcement (database):** a migration adding a `SECURITY DEFINER` trigger on `public.profiles` that rejects reserved or malformed usernames on insert/update, plus a case-insensitive unique index so `Michael` and `michael` can never both exist. Client checks stay for friendly, immediate feedback; the database is the last word.

## Wave 2 — The canonical route

- Move the profile implementation to `src/routes/$username.tsx` with `createFileRoute("/$username")`, unchanged component, search schema, loader, error and not-found components.
- Guard inside the loader: if the segment is reserved or syntactically invalid, throw `notFound()` rather than querying.
- Static routes still win in TanStack Router, so `/blog`, `/blog/my-article`, `/gallery`, `/g/...`, `/api/...` are unaffected.

## Wave 3 — Legacy `/u/username`

`src/routes/u.$username.tsx` becomes a thin redirect only: `beforeLoad` throws `redirect({ to: "/$username", params, search, replace: true })`, preserving `?tab=`, `?post=`, `?story=`.

## Wave 4 — SEO and sharing

Update canonical, `og:url`, ProfilePage and Person JSON-LD to the root URL; update the profile entries in `sitemap.xml`, the author URLs in `blog.$slug.tsx`, and the `sameAs` URL in the collab page — all through `profileUrl()`.

## Wave 5 — Replace every generated profile link

Sweep the ~40 call sites to `to="/$username"` / `profilePath()`: Profile Peek, work credits, blog authors and entity tags, comments, collabs, groups, events lineup, friends/followers, notifications, DMs, member home, admin user detail, `/me` redirect, username mentions. Unrelated `/u/` strings are left alone.

## Wave 6 — Edit Profile and username UX

Show `workshopindie.com/username` in the link-in-bio block with the existing Copy button and helper copy. As the user types: normalize, show the live URL, show "That username is reserved by Workshop." for reserved words, and check availability against existing handles before save. Save errors from the database trigger surface as friendly inline messages.

## Wave 7 — Routing checks

Verify in the running app: `/blog`, `/blog/<slug>`, `/gallery`, `/g/<slug>`; a real creator at `/username`; a nonexistent handle rendering the not-found screen (no server error); `/u/<name>` and `/u/<name>?tab=blog` redirecting with the query intact; direct load and refresh (server-rendered, not just client navigation); logged-out access.

## Wave 8 — Regression pass

Profile tabs and sharing, Gallery links, work credits, Peek, groups, blog authors, collabs, events, DMs, follows, admin links, sitemap, onboarding, Edit Profile copy action.

## Notes

- No visual redesign, no data-model change beyond the username guard trigger and case-insensitive index.
- Only creator profiles move to the root namespace; works, groups, blog posts, collabs, events, cities keep their prefixes.
