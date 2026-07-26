Wave 4 is roughly 80% complete: the central copy module (`src/lib/entitlement-copy.ts`) and pricing-page bullets are wired, but the Settings page and a few gate touchpoints still need the final UI pass. Wave 5 is the next logical step after that.

## Wave 4 — Remaining UI/UX finish

1. **Settings "This month" usage panel**
   - Wire `getUsageSummary` from `src/lib/entitlements.functions.ts` into `PlusSection` in `src/routes/settings.tsx`.
   - For Free members, show a 4-row grid: Works, Open Collabs, Lounge audio, Blog posts with `used / cap` and the reset date.
   - For Plus members, show a concise confirmation of unlimited access plus subscription status/renewal date.

2. **Settings copy cleanup**
   - Replace the hardcoded "Free includes 10 published Works…" paragraph in `PlusSection` with bullets from `freePlanBullets()`.
   - Remove any stale "Galleryhop Plus" or old premium wording if still present.

3. **Typed `PlusGate` reasons**
   - Add an optional `reason?: "work_limit" | "collab_limit" | "blog_limit" | "lounge_limit"` prop to `src/components/plus-gate.tsx`.
   - When `reason` is passed, render the matching title/body from `entitlement-copy.ts`; keep the generic fallback for existing callers.
   - Update `src/routes/works.new.tsx`, `src/routes/collab.new.tsx`, `src/routes/me.blog.$id.tsx`, and `src/components/media-panel.tsx` to pass the specific reason.

4. **Near-limit nudges**
   - In the Blog editor, show a subtle "1 of 2 posts left this month" chip when the user is at `cap - 1`.
   - In the Lounge media panel, show a low-profile "X minutes remaining this month" hint when under 30 minutes.

## Wave 5 — Payment and entitlement hardening

1. **Checkout lookup-key allowlist**
   - Add `const ALLOWED_PRICE_LOOKUP_KEYS = ["plus_monthly"] as const` in `src/lib/payments.functions.ts`.
   - Reject any `priceId` not in the allowlist before calling Stripe.

2. **Webhook entitlement handling**
   - In `src/routes/api/public/payments/webhook.ts`, ensure `invoice.payment_failed` updates the matching `subscriptions` row to `past_due` (or `unpaid` if Stripe already marked it) so entitlement resolution falls back to Free correctly.
   - Verify that `customer.subscription.deleted` and `cancel_at_period_end` preserve the existing `current_period_end` and only downgrade after the paid period ends (current logic mostly does this; confirm and add a regression check).
   - Confirm duplicate webhook events remain idempotent via `processed_stripe_events`.

3. **Entitlement trust boundary**
   - Ensure no component or server function claims Plus from the raw `subscriptions` row outside of `resolveEntitlements`. Use `usePlus` and `resolveEntitlements` as the single source of truth.
   - Confirm `active` and `trialing` with a future `current_period_end` grant Plus; everything else resolves to Free.

4. **Sandbox/live separation**
   - Verify every `subscriptions` read/write filters by `environment`, and that the webhook `env` query parameter matches the checkout `environment` path.

5. **No new tiers**
   - Keep `plus_monthly` only; do not create annual or other products.

## Wave 6 — Audit (deferred until after Wave 5)

- Repository-wide sweep for stale terms: "30 minutes", "30 min", "per day", "Lounge minutes today", "priority seat", "boosted placement", "Plus badge", "Credits strip", "Galleryhop Plus", "host Lounge", "Lounge host", "saved setup", "creator insights".
- Verify consistency across `/pricing`, Plus gates, Settings, Blog dashboard, Blog editor, Lounge entry, Work creation, Collab creation, and metadata descriptions.

## After each wave

Report: changed files, migrations added, entitlement/quota logic introduced, tests performed, remaining inconsistencies, and any intentionally deferred decisions.