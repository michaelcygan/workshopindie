# Workshop Independent — podcast application funnel

A small acquisition primitive: a public application page at `/applypodcast`, an admin review tool at `/admin/podcast`, and better discoverability for the email list Workshop already collects.

## Wave 1 — Data primitive

New table `podcast_applications`: name, email, field, specialization, portfolio_url, social_handle, city, process_description, current_work, conversation_topics, marketing_opt_in, status, internal_notes, user_id (nullable), created_at, updated_at (with the standard updated-at trigger).

Status values: `new`, `reviewing`, `shortlisted`, `invited`, `recorded`, `declined`, `archived` — default `new`.

Access rules:
- Nobody can read applications except admins (via the existing role function). No public read.
- No public write directly to the table — inserts go through a server function using privileged access after validation, matching how the newsletter form already works.
- Admins can update status and internal notes.

## Wave 2 — Public page `/applypodcast`

Editorial layout in the existing Workshop system: small "Workshop Independent" eyebrow, large display headline, two-sentence intro, then the form in a controlled reading column. Small closing note underneath.

Form:
- Required: Name, Email, Field, Portfolio/social URL, "Tell us about your process" (textarea, with the helper copy you wrote).
- Optional: specialization (freeform, one line), City, What are you working on right now, What would you enjoy talking about, Instagram/social handle.
- Optional unchecked checkbox: "Send me occasional Workshop updates, opportunities, and events."
- Hidden honeypot field, same pattern as the newsletter form.

Field selector uses the canonical taxonomy already in the codebase (Music, Film & Video, Writing, Visual Art, Design, Performance, Journalism & Media, Software & AI, Making & Engineering, Science & Research, Architecture & Cities, Environment & Nature, Other) — including "Other" here so interdisciplinary people aren't boxed in. The optional specialization line covers the rest.

Submission: validate (lengths, email, URL normalization using the existing URL helper), run the text through Workshop's existing moderation service like every other public text write, save the application, and — only if the box is checked — subscribe the email through the existing newsletter system with source `podcast_application`. The application saves either way. Signed-in visitors get their `user_id` attached automatically; no auth required and no account is created.

Success state replaces the form with your "Application received." copy — quiet, no animation.

Metadata: title "Apply to Workshop Independent | Workshop", your suggested description, self-referencing canonical and og tags, indexable.

## Wave 3 — Admin `/admin/podcast`

Added to the Manage group in the existing admin nav, labelled "Podcast", using the same layout and auth as the other admin pages.

- Top: counts for Total, New, Shortlisted, Invited.
- Table: Name, Field, Location, Submitted, Status. Status filter chips.
- Clicking a row opens a detail sheet (the pattern used elsewhere in admin) showing everything, with clickable portfolio/social links, marketing opt-in state, and the linked Workshop account when present.
- Actions in the sheet: change status, edit internal notes, copy email, open link, archive.

## Wave 4 — Email list discoverability

Keep `newsletter_subscribers` and the existing subscribers screen as the canonical implementation — no second table, no second page. Add an "Email list" item to the admin Manage nav pointing at the existing subscribers route, and add a source filter plus per-source counts to that page. CSV export stays exactly as it is (export respects the active source filter).

Analytics: Workshop has no client-side event provider, and I'm not adding one. Funnel visibility comes from the data itself — application counts over time and subscriber counts by source (`footer` vs `podcast_application`) — surfaced on the two admin pages above.

## Wave 5 — QA

Logged-out and logged-in submission; marketing checked and unchecked; already-subscribed and previously-unsubscribed emails; invalid email/URL; honeypot and rate-limit behavior; mobile layout; admin authorization; status changes; internal notes; CSV export unchanged.

## Technical notes

- Migration creates the table with grants, RLS, admin-only select/update policies, and the shared updated_at trigger.
- `src/lib/podcast.functions.ts`: public `submitPodcastApplication` (validated, moderated, rate-limited via the existing `check_and_bump` RPC) plus admin-gated list/detail/update functions following `newsletter.functions.ts` conventions.
- New route files `src/routes/applypodcast.tsx` and `src/routes/admin.podcast.tsx`; nav entries added to `src/routes/admin.tsx`.
- No refactors outside these files plus the subscribers page's filter addition.
