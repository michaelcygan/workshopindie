## Goal
Remove the "RSVP → free trial" (event promo pass) module and related conditional UI so it no longer takes space or runs branching logic. Do this without touching the database schema (safe/surgical) — the `promo_pass_months` / `promo_pass_granted_at` columns and `grant_promo_pass` RPC remain in place but become inert from the app's perspective.

## Scope

### Frontend removal
1. **Delete component**: `src/components/event-promo-pass-banner.tsx`.
2. **Event detail page** (`src/routes/g.$slug.e.$eventSlug.tsx`): remove `EventPromoPassBanner` import, the `{ev.promo_pass_months > 0 && …}` block, and drop `promo_pass_months` from the row type.
3. **Group page** (`src/routes/g.$slug.index.tsx`): remove the `+{promo_pass_months}mo Plus` chip and drop `promo_pass_months` from the select list + type.
4. **Event card** (`src/components/event-card.tsx`): remove `promo_pass_months` field + the `+Xmo Plus` badge.
5. **Featured events carousel** (`src/components/featured-events-carousel.tsx`) and **compact** (`src/components/featured-events-compact.tsx`): remove the two "RSVP unlocks a free trial" strings (empty-state copy stays neutral: e.g. "Workshops, open mics, listening parties.").
6. **Events index** (`src/routes/events.index.tsx`): drop `promo_pass_months` from the select list and remove the "RSVP unlocks a free trial" tagline.
7. **RSVP block** (`src/components/event-rsvp-block.tsx`): drop the `promo_pass_granted_at` prop from its type (nothing renders it after banner removal).
8. **Group events server fn** (`src/lib/group-events.functions.ts`): remove `promo_pass_months` from EVENT_COLS and `promo_pass_granted_at` from the RSVP select.
9. **Notifications bell** (`src/components/notifications-bell.tsx`): remove the `event_promo_pass_granted` icon entry and its `case` branch (falls through to default rendering — existing notifications still display generically).

### Admin surface
10. **Admin events page** (`src/routes/admin.events.tsx`): remove the `promo_pass_months` column, form field, default (`1`), and payload key.
11. **Admin import dialog** (`src/components/admin-import-event-dialog.tsx`): drop the two `promo_pass_months: 0` payload entries.
12. **Admin server fn** (`src/lib/group-events-admin.functions.ts`): remove `promo_pass_months` from the create/update Zod schemas and from the list `.select()`.

### Explicitly NOT touched
- `src/integrations/supabase/types.ts` — auto-generated; leaves nullable columns visible but unused.
- No DB migration — columns/RPC stay for historical rows and to avoid destructive changes.
- `src/routes/pricing.tsx` — the "14-day free trial" there is the Plus subscription trial, not the RSVP promo. Left alone.

## Verification
- `tsgo` typecheck passes.
- Event detail page renders without the banner; layout collapses cleanly.
- Group + events index + cards no longer show the "+Xmo Plus" chip.
- Admin event create still works end-to-end (form submits without `promo_pass_months`).
