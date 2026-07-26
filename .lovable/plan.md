The active `.lovable/plan.md` is a QA checklist for Collab Tasks (functionally complete). The standing `.lovable/logged-out-strategy.md` has five prioritized wedges; Wedge 1 (Collab as casting brief) is already shipped. The remaining work can be combined into a single Wave.

Wave: Public Surfaces & Shareable Actions

Goal: make every public page on Workshop (Events, Profiles, Works, Cities) a shareable, actionable landing page for logged-out visitors, using the same handoff pattern already built for Collab guest applications.

Phase 1 — Extend the handoff pattern to Events and Workshops
- Add a logged-out RSVP form on event/workshop pages.
- Create a guest-token row for logged-out RSVPs (name + email + claim_token, 14-day expiry).
- Post-submit CTA pre-fills `/signup` with the captured data and `claim` token.
- Backfill the RSVP to the user's account on signup (existing trigger pattern for guest applications).
- Owner sees unified guest + authenticated RSVPs.

Phase 2 — Profile as discoverable talent page
- Make public profile pages SEO-friendly with role, medium, and city facets.
- Add canonical landing pages like `/talent/<role>/<city>` (e.g., `/talent/cinematographers/los-angeles`).
- Index profile content by city and role for searchability.
- Add a "Contact / Work with me" CTA that uses the handoff pattern for logged-out visitors.

Phase 3 — Work as portfolio asset with CTA
- Add "Want to collaborate with [credits]?" CTAs on public Work pages.
- Link to the creator's DMs or to a new Collab creation flow.
- Optionally: a lightweight `<script>` embed widget for external sites, generating backlinks.

Phase 4 — City pages as SEO trunk
- Build per-city landing pages that aggregate open Collabs, upcoming Events/Workshops, and standing Meetups.
- Add structured links and discovery from each city to the relevant content.
- Deepen indexability for existing partial city pages.

Cross-cutting primitives (applied across all phases)
- `?via=<username>` inviter attribution in share URLs.
- Generated OG cards per public surface (Collab, Event, Workshop, Work, Profile, City).
- JSON-LD per content type: JobPosting (Collab), Event (Event/Workshop), CreativeWork (Work), Person (Profile), WebPage/CollectionPage (City).
- Application-receipt/RSVP-receipt routes for low-info public confirmation.
- A maintained `sitemap.xml` covering all public surfaces.

Why one Wave works
- All wedges share the same handoff pattern and the same cross-cutting SEO/metadata primitives.
- Building them in sequence lets later phases reuse the components and routes from earlier phases.
- The total scope is large but cohesive; it can be split into the four phases above without breaking the narrative.

Recommended execution
Ship this as one Wave with the four phases above. If you prefer to split it, Phase 1 + the cross-cutting primitives form the minimum viable next wave (extends handoff + OG cards/JSON-LD), while Phases 2–4 are the follow-up wave.