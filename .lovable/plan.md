# Workshop Open House application funnel

A small, private intake funnel for people who want to perform, DJ, speak, read, screen, or demonstrate at a future Open House. It mirrors the existing Podcast application end to end — same page layout, same server-function shape, same admin review screen — and touches nothing in the Event, RSVP, or lineup systems.

## What gets built

**Public page — `/applyopenhouse`**

Same restrained editorial chrome as `/applypodcast`: `max-w-3xl` column, uppercase eyebrow ("Workshop Open House"), headline ("Apply to perform or present."), one intro paragraph, then the form. No hero, imagery, FAQ, testimonials, or nav entry.

Fields, in order (desktop pairing noted):
- Your name (required, 120) + Act, project, or organization (optional, 140) — paired
- Email (required, lowercased) + What would you like to do? (required select) — paired
- Program type values: `live_music`, `dj_set`, `performance`, `talk`, `reading`, `screening`, `demonstration`, `other` — a local vocabulary, not the Field taxonomy
- Where are you based? (required, `GlobalLocationCombobox`, stores label + `city_id` when matched)
- Link to your work (required, URL-normalized on blur and server-side) + Workshop URL (optional, full URL or bare handle) — paired
- What would you like to bring to Open House? (required textarea, 40–3000, ~5 rows, quiet inline min-length hint)
- Approximate length (optional select: `under_15`, `15_30`, `30_60`, `over_60`, `flexible`)
- What would you need? (optional textarea, 1000, ~3 rows)
- Hidden honeypot field

Bottom of form matches Podcast: logged-out visitors see an optional "Also create my Workshop account." checkbox (application saves first, then redirect to signup prefilled with `from=open_house_apply`); signed-in visitors get prefill (name, email, Workshop URL, location, first useful external link) with the same quiet "we filled this in, you can edit it" note and no account checkbox. Everyone sees the unchecked marketing checkbox. Submit button "Submit application", with "No account needed." beside it when logged out.

Success replaces the form with the same quiet bordered panel: "Application received." Fires `submit_application` with `form_name: "apply_open_house"`.

**Admin page — `/admin/open-house`**

Direct clone of `/admin/podcast` structure: title "Open House applications", one-line description, four count cards (Total, New, Shortlisted, Booked), status filter chips, responsive table (Applicant / Program / Location / Submitted / Status), and a detail sheet with every field, copy-email button, external links, resolvable Workshop profile link, status selector, and internal notes. Applicant cell shows act/project name with contact name underneath when present. Header carries an "Open application page" link to `/applyopenhouse`, and the sheet carries the internal venue-safeguard note verbatim. "Open House" is added to Admin → Manage immediately after "Podcast".

## Technical notes

- **Migration (additive):** `public.open_house_applications` with the listed columns, CHECK constraints on `program_type`, `approximate_length`, and `status` (`new`, `reviewing`, `shortlisted`, `contacted`, `booked`, `declined`, `archived`), the existing updated-at trigger, `GRANT ALL ... TO service_role` only (no `anon`/`authenticated` grants), RLS enabled with no public or applicant policies. All access is through the service-role server client.
- **`src/lib/open-house-applications.functions.ts`** — `submitOpenHouseApplication` (public), `adminListOpenHouseApplications`, `adminUpdateOpenHouseApplication`. Copies the Podcast patterns: `parseFriendly` Zod validation, honeypot silent-success, `normalizeUrl`, `parseWorkshopUsername`, salted daily IP hash + `check_and_bump` with action key `open_house_application` (5/hour), optional bearer-token user attach, `moderateOrThrow` over contact name, project name, proposal, and setup needs, insert via `supabaseAdmin`, newsletter opt-in via `upsertNewsletterSubscriber(email, "open_house_application")` in a try/catch. Admin functions use `requireSupabaseAuth` plus the same server-side `user_roles` admin check.
- **Notification:** new kind `open_house_application_new` delivered to all admins via `notifyMany`, payload `{ name, program_type, city }`, wrapped in try/catch. `notifications-bell.tsx` gains an icon, title, and `/admin/open-house` href for the kind.
- **SEO/routing:** self-canonical `https://workshopindie.com/applyopenhouse`, OG + Twitter meta, indexable; `/applyopenhouse` added to `STATIC_PATHS` in `sitemap[.]xml.ts` and to the reserved-username list in `src/lib/usernames.ts`. No global nav entry, no Event-page CTAs.

Files: one migration, `src/routes/applyopenhouse.tsx`, `src/lib/open-house-applications.functions.ts`, `src/routes/admin.open-house.tsx`, `src/routes/admin.tsx`, `src/routes/sitemap[.]xml.ts`, `src/components/notifications-bell.tsx`, `src/lib/usernames.ts`, plus generated route/Supabase types.

## Out of scope

No `open_house` event kind, no Event/lineup/venue association, no `event_id` column, no duplicate-submission blocking, no file uploads, no platform email, booking, contracts, payments, or scheduling. No refactor of the Podcast flow into a shared framework.
