# Pricing v1 — Free vs Plus ($4.99/mo via Stripe)

Scheduled Workshops are out of v1. Plus earns its keep on **city reach, Lounge time, portfolio volume, and Collab reach** — not on media quality (subjective + not economical at this price) and not on custom-named rooms (too close to scheduled Workshops).

**No grandfathering.** Price is current price; future feature tiers can stand on their own.

## Tier split

### Free — "real artist starter"
- Profile, follows, DMs, comments, credits, search — never gated
- **Cities: home city only** (pick one on onboarding; can change once every 30 days)
- Gallery: full browse, but city filter locks to home city
- **Portfolio: 10 published works**, standard media upload (size cap enforced by storage, not advertised as "HD")
- **Open Collabs: 2 active** at a time; apply to unlimited
- **Instant Lounge: 60 min/day** rolling 24h, across all rooms. Joins any public/medium room.

### Plus — $4.99/mo
- **All cities** — join, post, filter gallery by any city, see full city feeds
- **Unlimited Lounge time** + priority seat into the fullest medium-matched lounge
- **Unlimited published works** with media upload
- **Unlimited active open Collabs** + boosted placement in city feed + gallery
- Plus badge on profile + Credits strip emphasis
- Work analytics (views, saves, origin cities)
- **Early access to new features** as they ship (Workshops, exports, more) — called out explicitly in pricing copy

## Why these gates
The Lounge time cap is the cleanest emotional gate: an artist actually using the product to network will burn through 60 min finding their needle in the haystack, and the upgrade ask lands at the exact moment of "this is working." The home-city gate makes Plus the obvious choice for anyone touring, scouting, or collaborating across cities — without locking core discovery away. Portfolio + Collab caps are the long-tail value.

## Enforcement points

```text
gate                     where it lives
─────────────────────    ──────────────────────────────────────────────
home-city-only           cities.index.tsx (lock other city cards),
                         cities.$slug.tsx (block join + post),
                         gallery.tsx (force city = home_city_id for free),
                         collab.new.tsx (city selector locked to home)
10-work portfolio cap    works.new.tsx — count published works, block + upsell
2-active-Collab cap      collab.new.tsx — count user's open posts, block + upsell
60min/day Lounge cap     instant.index.tsx + use-media-room.tsx —
                         check lounge_minutes_today() before drop,
                         evict at cap with PlusGate sheet
Boosted placement        gallery + cities feed queries — order by is_plus DESC
Plus badge               profile, work-card, comment-thread, credit-strip
Analytics                me.tsx → new "Insights" tab, Plus-only
```

## Database / backend

1. **`profiles.home_city_id`** — nullable FK; set during onboarding (existing city picker), editable from `/me/edit` with a 30-day cooldown enforced by a trigger.
2. **`subscriptions` table** — `user_id`, `tier` ('free' | 'plus'), `status` ('active' | 'canceled' | 'past_due'), `current_period_end`, `stripe_customer_id`, `stripe_subscription_id`. RLS: user reads own; webhook (admin client) writes.
3. **`has_plus(_user_id uuid)` SECURITY DEFINER fn** — single source of truth: `tier='plus' AND status='active' AND current_period_end > now()`. Used by RLS, server fns, and a client RPC.
4. **`lounge_minutes_today(_user_id uuid)` fn** — sums presence duration in last 24h from `instant_presence` joined_at/last_seen_at deltas.
5. **`use-plus.tsx` hook** — caches `has_plus()` and (when in a lounge) `lounge_minutes_today()`. Invalidated on auth change and every 5 min.

## Stripe integration

- Use Lovable's built-in Stripe (`enable_stripe_payments`) — no BYOK.
- Single product **"Workshop Plus"**, single monthly price **$4.99 USD**. No annual in v1.
- Tax handling: **calculation only** (option 2) — Stripe collects correct tax; we file. Cheapest option that still does the right thing for international buyers.
- Checkout: server fn `createCheckoutSession` → Stripe-hosted checkout → redirect to `/me?upgraded=1`.
- Customer portal: server fn `createBillingPortalSession` → Stripe-hosted manage/cancel.
- Webhook at `/api/public/stripe-webhook` — verifies signature, upserts `subscriptions` on `customer.subscription.*` events.

## New surfaces

1. **`/pricing` route** — two cards (Free / Plus $4.99), feature comparison, "early access to new features" called out in Plus copy, single "Go Plus" CTA. SEO meta + JSON-LD `Product`.
2. **`<PlusGate>` component** — reusable bottom sheet with the specific limit hit, value prop, and "Go Plus — $4.99/mo" button. Used by every gate above.
3. **`/me` → "Plan" section** — current tier, renewal date, "Manage billing" (portal) or "Go Plus" button.
4. **Top-nav** — small "Go Plus" pill for free users (dismissible per session); subtle Plus badge for subscribers.

## Out of scope
- Annual / lifetime / team plans
- Promo codes / referrals
- Custom-named rooms (deliberately not in v1 — too close to scheduled Workshops)
- Advertising specific media quality tiers ("HD", "4K") — we say "media upload" only

## Build order
1. Migration: `subscriptions` table, `has_plus()`, `lounge_minutes_today()`, `profiles.home_city_id` + cooldown trigger
2. Enable Stripe via `enable_stripe_payments`, create product, store price id
3. Server fns: checkout, portal, webhook; `use-plus` hook; `<PlusGate>` component
4. `/pricing` route + nav pill + `/me` Plan section
5. Wire gates one-by-one (cities → lounge → portfolio → collabs), each with PlusGate

Confirm and I'll start with the migration.
