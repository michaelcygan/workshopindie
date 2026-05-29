# Referral Loop — Earn Free Plus

Give every user a shareable referral link. When someone they refer becomes a paying Plus subscriber, the referrer earns **1 free month of Plus** (stacked, no cap). Promoted via a "Refer & Earn" entry in the profile dropdown.

We already have `?ref=<username>` capture, `profiles.referred_by`, and a `referral_joined` notification. This plan adds the reward + the share UI.

## 1. Reward engine (DB + Stripe coupon)

Migration:
- Add `referral_credits` table: `id, user_id, referred_user_id, months_granted int default 1, stripe_coupon_id text, applied_at timestamptz default now(), source text default 'plus_signup'`. Unique on `(user_id, referred_user_id)` so each referral pays out exactly once.
- RLS: users can SELECT their own rows; no client writes (service role only).
- View `referral_stats` (or a SECURITY DEFINER function `get_referral_stats(uid)`) returning `{ signed_up_count, paid_count, months_earned }` for the dropdown card and a small dashboard widget.

Webhook (`src/routes/api/public/payments/webhook.ts`):
- In `handleSubscriptionUpsert`, when status becomes `active` or `trialing` AND `tier = 'plus'` AND this is the first time we've ever seen this user paid (check absence of prior credit), look up `profiles.referred_by` for that user.
- If a referrer exists and isn't the same user: ensure a Stripe coupon exists for the referrer (1 free month = `percent_off: 100, duration: 'repeating', duration_in_months: 1`), apply it to the referrer's active Plus subscription via `stripe.subscriptions.update({ discounts: [{ coupon }] })` — Stripe stacks discounts on subsequent invoices, so if they're already discounted we instead extend `trial_end` by 30 days (simpler stacking guarantee). We'll use the **`trial_end` extension** approach uniformly: `stripe.subscriptions.update(subId, { trial_end: currentEnd + 30days, proration_behavior: 'none' })`. This works whether the referrer is currently trialing, active, or canceled-with-time-left, and reliably stacks.
- If the referrer doesn't have an active Plus sub yet, store the credit as `pending` — applied on their next checkout via a `coupon` param (already-supported in `createCheckoutSession`).
- Insert into `referral_credits` for idempotency. Send notification `referral_reward_earned` to the referrer.

## 2. Share UI — "Refer & Earn"

New route `src/routes/refer.tsx` (auth-gated):
- Hero: "Give a month, get a month. Free Plus for every friend who upgrades."
- Big copy-to-clipboard link: `https://workshopindie.com/?ref=<username>`
- Stats row: friends joined · friends on Plus · months earned · next reward
- Buttons: Copy link, Share to Instagram Story (uses Web Share API on mobile; on desktop, copy link + open instagram.com with toast "paste into your story"), Share to WhatsApp/X/Email (reuse `<ShareSheet>`).
- Small "How it works" — 3 steps.

Dropdown (`src/components/top-nav.tsx`):
- Add `<DropdownMenuItem>` "Refer & Earn" with `Gift` icon, between "Go Plus" and the divider. Same item in `mobile-nav.tsx`.

Notifications (`src/components/notifications-bell.tsx`):
- Route `referral_reward_earned` → `/refer`.

## 3. Out of scope

- No referral leaderboard, no cash payouts, no multi-tier (no rewarding the referee).
- No fraud detection beyond "must be a paid Plus conversion + unique (referrer, referee) pair" — Stripe's payment requirement is the main filter.
- Existing `?ref` capture, `referred_by` column, and `referral_joined` notification are untouched.

## Files

Create: `src/routes/refer.tsx`, `src/lib/referrals.functions.ts`, migration for `referral_credits` + stats function.
Modify: `src/routes/api/public/payments/webhook.ts`, `src/components/top-nav.tsx`, `src/components/mobile-nav.tsx`, `src/components/notifications-bell.tsx`, `src/lib/payments.functions.ts` (accept optional pending-credit coupon on checkout).
