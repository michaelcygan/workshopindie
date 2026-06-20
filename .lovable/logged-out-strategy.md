# Logged-Out Strategy — Workshop

**Status:** active. Future plans should cite this doc by section.

---

## 1. Thesis

Workshop is the **public registry of creative work-in-progress**. The moat is logged-out utility: Profiles, Works, Collabs, Events, and Workshops are public by default; non-users can read, RSVP, and apply. Account creation is a *consequence of value delivered*, not a gate in front of it.

Reference shape: Partiful (event-as-share-object) + Eventbrite (public event page is the product) + Backstage / Casting Networks (the brief is the unit of work). Workshop stacks all three because the underlying primitives are already public.

## 2. Posture (3 / 5 — balanced)

- Logged-out users can read everything that should be public, and can **submit** (RSVP, apply, contact) without an account.
- After **any** submission, immediately prompt account creation with the form data prefilled. Never block the value behind a wall.
- Signup prompts should be tasteful and value-anchored ("create an account to track this / DM the host / edit your application") — not generic interstitials.

## 3. Hard constraints

- **No email sends, no SMS, no third-party comms APIs.** Reachback to a guest happens *in-app after they create an account.*
- **No magic-link email inboxes.** Use sessionStorage / URL-param handoff at submission time, plus email-keyed auto-adoption on signup (DB trigger or server fn).
- **No external dependencies** introduced for logged-out work. JSON-LD, OG tags, sitemap, structured data are all fine — they're static metadata, no calls.
- Rate-limit anonymous submissions by hashed IP (already in place for guest apps) to prevent spam without storing PII.

## 4. The handoff pattern (canonical)

For every logged-out submission surface:

1. Record submission in a guest table (or guest-token row) with email + minimal data.
2. Issue a `claim_token` UUID for that row, expires in 14 days, returned to the client.
3. Client offers post-submit signup CTA: prefill display name, email, and any other captured fields via `?email=&first=&last=&claim=…` search params on `/signup`.
4. On signup, two paths converge:
   - **Explicit:** `claim` param → server fn matches that row by token.
   - **Implicit:** DB trigger on `auth.users` insert backfills any unmatched rows with `lower(email) = new.email`. (Already exists for `collab_guest_applications` via `backfill_guest_applications_on_signup`.)
5. Owner sees one unified inbox — guest and claimed-by-account applications show side-by-side.

Apply this pattern to every new logged-out surface (RSVPs, profile inquiries, work CTAs).

## 5. Prioritized wedges

1. **Collab as casting brief** — JobPosting JSON-LD + the handoff pattern above. *(Wedge 1 — shipping now.)*
2. **Event/Workshop as Partiful page** — logged-out RSVP form with the same handoff. Reminders happen in-app after signup.
3. **Profile as discoverable talent page** — public-by-default for Work surfaces; role/medium/city facets; SEO landing pages like `/talent/cinematographers/los-angeles`.
4. **Work as portfolio asset with CTA** — every public Work surfaces "Want to collaborate with [credits]?" linking to Collab / DM. Optional `<script>`-embed widget for external sites = SEO backlinks.
5. **City pages as SEO trunk** — index every standing meetup, upcoming event, and open Collab per city. Already partial; deepen indexability.

## 6. Cross-cutting primitives to layer in over time

- **Inviter attribution** encoded in share URLs (`?via=<username>`). When a logged-out invitee submits, both sides see "via [name]."
- **Generated OG cards** per public surface — Collab, Event, Workshop, Work, Profile. The OG image *is* the share image; no logo placeholders.
- **JSON-LD per content type:** JobPosting for Collabs, Event for Events/Workshops, CreativeWork for Works, Person for Profiles. Each route's `head()` emits structured data from loader data.
- **Application-receipt routes** — a publicish, low-info confirmation URL guests can share ("I applied to direct this short film on Workshop"). Turns applications into outbound marketing without leaking PII.
- **`sitemap.xml`** must include every public Collab, Event, Workshop, Work, Profile, City. Refresh as content is added.

## 7. What Workshop becomes

Not "another social network for creatives." It becomes the **searchable, shareable, transactable public layer for creative work-in-progress** — every brief, every room, every credit, every showcase indexable and usable by people who haven't signed up yet. Accounts get created because value was delivered first.
