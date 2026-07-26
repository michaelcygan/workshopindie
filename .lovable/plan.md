# Workshop Plus Grants & Claim Links

Adds a complimentary/lifetime Plus system separate from Stripe billing, plus admin-created hashed-token claim links (`/plus/claim/<token>`). Paid Stripe flow, referral rewards, and legacy `/redeem/$code` links keep working.

## Architecture

**One authoritative resolver** — `resolveEffectivePlusAccess(userId)` in `src/lib/plus-access.server.ts` combines the Stripe `subscriptions` row with active grants and returns:

```ts
{ isPlus, tier, source: "free"|"paid"|"stripe_trial"|"complimentary"|"lifetime",
  lifetime, accessStartsAt, accessEndsAt, paidSubscription, activeGrant }
```

Client mirror via a `getMyEffectivePlusAccess` server fn; `usePlus` swaps its query to this. `resolveEntitlements` accepts the resolver result — a lifetime/complimentary user gets the exact Plus entitlement bundle (no ranking/badge/admin side effects). All server gates (works, collabs, lounge, blog, checkout, settings, nav) go through the resolver.

**Grants ≠ subscriptions.** `subscriptions` stays Stripe-only. Complimentary/lifetime lives in a separate ledger. `redeemCompMembership` is refactored to create a grant instead of upserting a fake subscription row, but the `/redeem/$code` route stays.

## Data model (Wave 1 & 3 migrations)

- `public.plus_access_grants` — id, user_id, environment, benefit_type (`months`|`lifetime`), duration_months, status (`pending`|`active`|`applied_to_stripe`|`revoked`|`expired`|`failed`), access_starts_at/ends_at, source (`admin_direct`|`offer_link`|`legacy_comp`|`event_promo`|`referral`|`other`), source_id, application_method (`local_entitlement`|`stripe_extension`|`lifetime_override`), stripe_subscription_id, granted_by, note, timestamps, revoked_by/at. Check constraints enforce months>0 for `months`, null for `lifetime`.
- `public.plus_offer_links` — campaign_name, `token_hash` (unique, sha256 of raw token), benefit_type, duration_months, environment, status, max_redemptions (required for lifetime, default 1), expires_at, created_by, note. Raw token never stored.
- `public.plus_offer_redemptions` — offer_id, user_id, grant_id, redeemed_at, unique(offer_id,user_id).

RLS: users select their own grants only; offers not readable by users at all; admin server fns do all writes. Full GRANTs per rules.

**Atomic claim RPC** `public.claim_plus_offer(_token_hash, _user_id)` — SECURITY DEFINER, `FOR UPDATE` on the offer row, validates status/expiry/max/dedupe, inserts grant + redemption, flips offer to `exhausted` on final claim, returns grant id. Prevents concurrent over-redemption.

## Shared Stripe extension service (Wave 2/4)

Extract `applyComplimentaryPlusBenefit({ userId, months, source, grantId })` in `src/lib/plus-benefits.server.ts` from the existing referral-rewards webhook path. Behavior:

- No paid sub + timed → local grant only; `access_ends_at = max(now, existing active grant end) + months*30d`.
- No paid sub + lifetime → local grant, `access_ends_at = null`.
- Paid sub + timed → extend Stripe (trial_end or coupon per current referral logic), record `stripe_subscription_id`, mark `applied_to_stripe`; fall back to local grant if Stripe call fails.
- Paid sub + lifetime → create lifetime grant immediately, schedule `cancel_at_period_end=true` on the Stripe sub. Never refund.
- Lifetime already active → reject monthly grants with clear message.

Checkout path (`src/lib/payments.functions.ts`) reads the resolver first — if a timed grant exists, set the Stripe subscription `trial_end` to the later of complimentary end vs. normal trial; if lifetime is active, hide/deny normal Plus checkout.

Referral webhook is refactored to call the same service instead of duplicating logic.

## Admin surfaces

**`/admin/users/$id`** — new "Plus Access" panel: effective source + end date, active grants list, actions (Grant 1/3/6/12/Custom months, Grant Lifetime, Revoke). Confirmation dialogs for lifetime grant, lifetime revoke, and paid-subscriber grants. Server fns: `adminGrantPlusMonths`, `adminGrantPlusLifetime`, `adminRevokePlusGrant` in `src/lib/admin-plus.functions.ts` — all guarded by existing `has_role('admin')` pattern, all write `admin_audit_log` entries (`plus.grant_months`, `plus.grant_lifetime`, `plus.grant_revoke`), send `plus_grant_received`/`plus_lifetime_received` notifications, invalidate resolver queries.

**`/admin/plus`** — new route (linked from admin nav under Revenue): create-link form (campaign name, benefit selector, max redemptions, expires_at, environment, draft/active, note; lifetime requires typing `LIFETIME`). On create returns raw token once — shown as full URL, copy button, "Replace link" action rotates the hash. Campaign list with status, claims/max, pause/resume/disable/duplicate/view-redemptions. Audit entries `plus.offer_create|pause|resume|disable|replace`. Disabling never revokes past redemptions.

Rate limiting via existing `rate_limits` table: 10 failed claims/hour/user. All error messages collapse to "This Plus offer is no longer available."

## Public claim route

`src/routes/plus.claim.$token.tsx`:
- GET (loader): hashes token, calls public server fn `previewPlusOffer` returning `{ claimable, campaign_name, benefit_type, duration_months, expires_at }` — no side effects, safe for link previews.
- Logged-out: renders benefit + "Sign in / Sign up to claim" preserving token in redirect param through OAuth (public callback, not protected).
- Logged-in: renders Claim button which POSTs `claimPlusOffer({ token })` (auth-required server fn calling `claim_plus_offer` RPC). Success shows access end (or "Lifetime"), invalidates subscription/entitlement/usage queries, links to `/settings#plus` and `/`.

## Settings & UI

`/settings#plus` gains 4 accurate states: Paid, Stripe Trial, Complimentary (through `date`, no card, no recurring — hide Manage Billing when no Stripe customer), Lifetime (no renewal/checkout/manage billing). Navigation Plus indicators, pricing page, and any "Upgrade" CTAs consult the resolver so lifetime users never see checkout prompts.

Revenue admin: complimentary/lifetime users excluded from paid counts / MRR; new operational counts "Complimentary Plus", "Lifetime Plus", "Offer claims".

## Waves

1. **Foundation** — `plus_access_grants` migration, resolver, `usePlus` swap, entitlement gate updates, tests. Nothing user-visible yet.
2. **Direct admin grants** — grant server fns, `/admin/users/$id` panel, notifications, audit, paid-sub Stripe handling (via new shared service).
3. **Marketing offers & claim** — offer/redemption tables, atomic RPC, `/admin/plus`, `/plus/claim/$token`, rate limiting.
4. **Stripe hardening** — extract shared benefit service, refactor referral webhook to use it, checkout trial-end logic, lifetime cancel-at-period-end, sandbox/test-clock verification.
5. **Legacy migration** — refactor `redeemCompMembership` to create a grant; backfill redeemed `comp_memberships` into grants with `source='legacy_comp'`; keep `/redeem/$code` working.
6. **Reporting & QA** — revenue split, settings copy, mobile passes, full matrix test (free/paid/trial/past_due/canceled-with-access/complimentary/lifetime/logged-out OAuth return/expired/exhausted/disabled/one-use/100-use/concurrent-final/revocation/webhook retry/sandbox-vs-live).

## Out of scope

Gifts, public promo code entry, transferability, family/team plans, refunds, public campaign analytics, email automation beyond existing primitives.

## Open questions before Wave 1

1. **Month length**: confirm "1 complimentary month = 30 days" for stacking math and end-date display (matches existing referral behavior).
2. **Environment scope**: grants and offers carry `environment` — should admin UI default to the current runtime env and hide the selector, or expose it (matches how the current comp/subscriptions surfaces handle it)?
3. **Lifetime + existing paid subscriber default**: schedule `cancel_at_period_end` automatically on lifetime grant (with strong confirmation), or leave the paid sub alone and require a separate "Stop future billing" action?