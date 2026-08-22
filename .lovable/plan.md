# Update Open House application copy

## Goal
Rewrite the description on `/applyopenhouse` to sell the partnership opportunity more clearly: applicants are helping Workshop put on events in their area, and they can partner. Keep the existing "no account needed to apply" reassurance.

## Current copy (src/routes/applyopenhouse.tsx:265-269)
> Workshop Open House is a gathering for people making things. Editions can include a performance, listening party, screening, talk, workshop, art and food vendors, and brand partners. Tell us what you'd bring — no account needed to apply.

## Proposed change
Replace the paragraph with copy closer to the user's direction:

> Tell us what you'd bring — we'll put on the show. Workshop Open House is a gathering for people making things, and we're building editions in your area. Editions can include performances, listening parties, screenings, talks, workshops, art and food vendors, and brand partners. No account needed to apply.

This keeps the same factual list, foregrounds the "we put on the show" value proposition, and explicitly mentions that events are being built in the applicant's area.

## Scope
- Edit only `src/routes/applyopenhouse.tsx` lines 265-269.
- No data model, routing, or functional changes.
