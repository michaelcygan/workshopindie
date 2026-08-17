# Workshop Film Festival — Submission Flow

Turn the `/film-festival` placeholder into a real landing page with a public film submission funnel, plus an admin review dashboard. Modeled exactly on the Open House and Podcast application flows (same form patterns, rate limiting, moderation, admin notifications, newsletter opt-in).

## What the filmmaker sees

`/film-festival` becomes an editorial landing page: what the festival is (traveling pop-up screenings hosted with partner venues), what we're looking for, and a clear "Submit your film" call to action.

The submission form (same one-page editorial form style as Open House):

- Your name (required)
- Email (required)
- Film title (required)
- Workshop profile link or handle (optional, auto-parsed)
- Where you're based — city picker (required)
- Format / category: short, feature, documentary, experimental, animation, music video, series or episode, other
- Runtime in minutes (required)
- Completion year (optional)
- Trailer link (required)
- Full film link — Drive, Vimeo, Dropbox, etc. (optional)
- Password or access notes for that link (optional)
- Logline (short, required)
- Synopsis / about the film (required, 40–3000 chars)
- Credits — director, cast, crew (optional, free text)
- Screening rights: checkbox confirming they have the rights to have the film screened at Workshop pop-ups, and that Workshop screening does not transfer any ownership (required to submit)
- Marketing opt-in checkbox
- "I'd like a Workshop account" checkbox
- Hidden honeypot field

On submit: friendly success state, same as the other funnels.

## What admins see

`/admin/film-festival` — a review dashboard matching `/admin/open-house`: status counts and filters, searchable list, and a detail sheet per submission with all fields, clickable trailer/film links, applicant's Workshop profile if linked, internal notes, and a status dropdown.

Statuses: New, Reviewing, Shortlisted, Selected, Programmed, Declined, Archived.

Admins get a notification in the bell for every new submission.

## Streaming / viewer URLs

Not built in this pass, as requested. The submission record stores the trailer and full-film links plus access notes, so a future viewer/playlist page has everything it needs to pull from.

## Technical notes

- Migration: `public.film_festival_submissions` with the fields above, `status` enum-style text with a check constraint, `internal_notes`, `created_at`, `user_id` nullable. Explicit `GRANT`s (`service_role` full, no anon/authenticated direct access — all reads/writes go through server functions), RLS enabled with admin-only policies.
- `src/lib/film-festival.ts` — shared vocabulary (statuses, labels, format options, field limits, row type), client-safe.
- `src/lib/film-festival.functions.ts` — `submitFilmFestivalSubmission`, `adminListFilmFestivalSubmissions`, `adminUpdateFilmFestivalSubmission`. Copies the Open House module's structure: `parseFriendly` Zod validation, honeypot short-circuit, `normalizeUrl` on trailer and film links, IP-hash rate limit via `check_and_bump` (`film_festival_submission`, 5/hour), optional bearer-token user attach, `moderateOrThrow` on every free-text field, admin `notifyMany`, newsletter upsert on opt-in.
- New notification kind `film_festival_submission_new` registered in the notifications bell renderer.
- Routes: rewrite `src/routes/film-festival.tsx` (landing + form, its own `head()` metadata) and add `src/routes/admin.film-festival.tsx`; add the admin link to the admin index.
- Add `/film-festival` to the sitemap and reserve `film-festival` in the reserved-username list.
