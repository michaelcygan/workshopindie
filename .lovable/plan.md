# Strategy doc + Wedge 1: Collab as casting brief

Two deliverables in one plan: commit the framing so future sessions inherit it, then ship the first wedge (Collab JobPosting SEO + logged-out apply → account-creation handoff). **Hard constraint from you: no email sends, no external APIs.** Anonymous submissions are recorded in the DB; the post-submit signup step uses the form data to prefill, and the new account adopts any prior guest applications keyed by email.

---

## Part 1 — Commit `.lovable/logged-out-strategy.md`

A short, opinionated strategy doc the agent reads on future planning sessions. Contents:

- **Thesis.** Workshop is the public registry of creative work-in-progress. Logged-out utility is the moat — Profiles, Works, Collabs, Events, Workshops are public by default; logged-out users can RSVP, apply, and view. Account creation is a *consequence of value delivered*, not a gate.
- **Posture: balanced (3/5).** Logged-out can read and submit. After any submission/action, prompt account creation with the form data prefilled. Never block the value behind a wall.
- **Hard constraints.**
  - No email sends, no SMS, no third-party comms APIs. Reachback happens in-app after the user creates an account.
  - No magic-link inboxes (would require email). Use sessionStorage handoff + email-keyed adoption instead.
  - JSON-LD / OG / sitemap work is fine — it's static metadata, no external calls.
- **Prioritized wedges** (1 first, others queued):
  1. **Collab as casting brief** — JobPosting schema, public application form, post-submit signup handoff. *(this plan, Part 2)*
  2. **Event/Workshop as Partiful page** — logged-out RSVP form → in-app reminder via signup CTA. Reminders happen because they create an account; no email loop.
  3. **Profile as discoverable talent page** — make public-by-default for work, add role/medium/city facets, SEO.
  4. **Work as portfolio asset with CTA** — embeddable widget, link-to-collaborate.
  5. **City pages as SEO trunk** — index every standing meetup, upcoming event, open Collab per city; subscribe-by-account.
- **Cross-cutting primitives** to layer in over time: inviter attribution encoded in share URLs, generated OG cards per public surface, application-receipt routes, JSON-LD per content type.

This doc is the source of truth. Future plans cite section numbers from it.

---

## Part 2 — Wedge 1: Collab as casting brief

### What exists already (confirmed)
- `src/routes/collab.$slug.tsx` — public Collab page
- `src/components/guest-apply-dialog.tsx` — guest application UI (already wired)
- `public.collab_guest_applications` table — 19 columns, RLS in place
- `src/lib/collab.functions.ts` + related — server fns

I'll read those four during build to map exact field names and existing flow before editing.

### Build steps

1. **JobPosting JSON-LD on `src/routes/collab.$slug.tsx`.**
   - Loader already fetches the post. Add a `head()` script tag emitting `application/ld+json` with `@type: JobPosting`. Map fields: `title`, `description`, `datePosted` (created_at), `validThrough` (ends_on), `hiringOrganization` (poster profile), `jobLocation` or `jobLocationType: "TELECOMMUTE"` based on `location_mode`, `employmentType: "CONTRACTOR"`, `baseSalary` when `compensation_type` warrants. Each role becomes one JobPosting (or one parent with role list) — pick whichever Google validates cleanly.
   - Also add Open Graph + Twitter card with title/description/cover.

2. **Make logged-out apply prominent & frictionless.**
   - Audit current `guest-apply-dialog.tsx`. Confirm: name, email, pitch, optional role selection, optional portfolio link. Keep the form lean — long forms kill logged-out conversion.
   - Surface the apply CTA above the fold for logged-out users on `collab.$slug.tsx`. The current page may already do this; if not, add it.
   - Client-side Zod validation (name, email format, length caps) per the input-validation guidance.

3. **Post-submit signup handoff (the key UX).**
   - On successful guest submission, instead of just a "thanks" toast, render a follow-up step in the dialog:
     > *Your application is in. Create an account to track it, edit it, and message the poster when they shortlist you.*
     With a single "Create account" button.
   - Stash the submitted form values in `sessionStorage` under a namespaced key (e.g. `ws.pendingApply.<collabId>`). Navigate to `/signup` (or `/auth`) with `?next=/collab/<slug>&adopt=apply`.
   - On the signup page, when `adopt=apply` is present and sessionStorage has data, prefill display name and email; after successful signup, call a new server fn `adoptGuestApplications` (see step 4), then route back to `next`.

4. **Email-keyed adoption server fn.**
   - New `src/lib/collab.functions.ts` export `adoptGuestApplications` — auth'd via `requireSupabaseAuth`. Reads the new user's verified email from `context.claims`, finds any `collab_guest_applications` rows with matching email, and links them to `context.userId` (either by inserting matching rows into `work_applications` / the canonical applications table, or by stamping a `claimed_by_user_id` column).
   - If `collab_guest_applications` doesn't already have `claimed_by_user_id` + `claimed_at` columns, propose a migration to add them in this plan's build phase (single migration, with GRANTs already in place since the table exists).
   - Trigger this server fn from the signup success handler when `adopt=apply` was set, **and** once from `src/routes/__root.tsx`'s auth listener on `SIGNED_IN` as a safety net so any guest submission made with an email that later becomes an account gets linked automatically — no email required.

5. **Poster-facing visibility.**
   - In the existing applicants panel (`src/components/applicants-panel.tsx`), show guest applications inline alongside member applications, badged "Guest". Poster can review/shortlist exactly the same way. (Should mostly already work; confirm + polish.)

### Out of scope (explicitly)
- No email notifications to guests when shortlisted (no external APIs). Guests learn status only after creating an account.
- No magic-link inbox.
- Other wedges (Workshop RSVP, Profile SEO, embeds) are queued in the strategy doc — not built here.

### Files touched (estimate)
- **Create:** `.lovable/logged-out-strategy.md`
- **Edit:** `src/routes/collab.$slug.tsx` (head/JSON-LD, logged-out CTA polish), `src/components/guest-apply-dialog.tsx` (post-submit signup step + sessionStorage stash), `src/routes/signup.tsx` (or wherever signup lives — prefill + adopt call), `src/lib/collab.functions.ts` (new `adoptGuestApplications`), `src/routes/__root.tsx` (auth listener safety-net call), possibly `src/components/applicants-panel.tsx` (guest badge polish).
- **Maybe migration:** add `claimed_by_user_id uuid` + `claimed_at timestamptz` to `collab_guest_applications` if not present.

### Verification
- Logged-out: visit a Collab, submit application → row appears in `collab_guest_applications` (verify with `psql`), signup step is offered with prefill on next screen.
- Signup flow: complete signup with same email → application row gets `claimed_by_user_id` stamped, user lands back on the Collab page with their submission visible to them.
- View source on a Collab page → JSON-LD `@type: JobPosting` is present and validates in Google's Rich Results test (manual check).

Approve and I'll commit the strategy doc, read the four existing files, propose the migration (if needed), then implement.
