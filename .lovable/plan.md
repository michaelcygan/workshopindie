Continue the Workshop Plus Grants system — Waves 2–6.

**Confirmed decisions**
- 1 month = 30 days for stacking math.
- Admin UI: default `environment` to current runtime (`live` in prod, `sandbox` in preview) and hide the selector.
- Lifetime grant on an active paid subscriber does NOT auto-cancel Stripe; it just wins locally. Reversible — revoking the lifetime grant restores paid-sub-only state. A separate "Cancel Stripe subscription too" checkbox is offered but off by default.

---

## Wave 2 — Direct admin grants

New server file `src/lib/admin-plus-grants.functions.ts` (all admin-gated via `requireSupabaseAuth` + `has_role(admin)` check):
- `listUserPlusGrants({ userId })` — returns full ledger for that user + resolved `EffectivePlusAccess`.
- `createAdminPlusGrant({ userId, benefitType: 'months'|'lifetime', durationMonths?, note? })` — inserts row with `source='admin_direct'`, `granted_by=caller`. For `months`: computes `access_starts_at = max(now, latest active timed grant end)`, `access_ends_at = starts + durationMonths*30 days` (stacking). For `lifetime`: `starts=now`, `ends=null`.
- `revokeAdminPlusGrant({ grantId, reason? })` — sets `status='revoked'`, `revoked_at`, `revoked_by`. Writes audit + notification.
- Every mutation writes `admin_audit_log` and inserts a `notifications` row for the target user ("Workshop Plus granted", "Workshop Plus removed").

Migration:
- Allow `authenticated` admins to SELECT any row (add policy `admins read all grants` using `has_role(auth.uid(),'admin')`). Writes stay service-role only via server fns.
- Add `plus_lifetime_single_active` partial unique index to prevent duplicate active lifetime grants per user.

UI — new section on `src/routes/admin.users.$id.tsx` "Workshop Plus":
- Effective status card (source, ends-at, lifetime badge, paid-sub state).
- "Grant Plus" form: benefit type (Months / Lifetime), months input (when Months), note. `environment` inferred, hidden.
- Ledger table of all grants with Revoke button (confirms).
- Lifetime grant to a paid subscriber shows an inline hint: "This user still has an active Stripe subscription; billing continues unless canceled separately."

## Wave 3 — Marketing offer links & claim flow

Migration adds:
- `public.plus_offer_links` — `id, slug (unique), name, description, benefit_type, duration_months, environment, token_hash (bytea, unique), max_redemptions (int null), redemption_count, expires_at, active bool, created_by, created_at`. No plaintext token stored.
- `public.plus_offer_redemptions` — `id, offer_id fk, user_id fk, grant_id fk, redeemed_at, ip_hash text`. Unique `(offer_id, user_id)` to enforce one-per-user.
- Grants on both (authenticated SELECT own redemptions; service_role ALL). Admin SELECT via `has_role` policy.
- Atomic RPC `claim_plus_offer(_token text)` (SECURITY DEFINER): hashes token, locks row `FOR UPDATE`, validates active/expiry/cap, inserts redemption, inserts grant (stacked per Wave 2 rules), increments count, returns `{ grant_id, ends_at, benefit_type }`.

Server fns in `src/lib/plus-offers.functions.ts`:
- `adminCreatePlusOfferLink({ name, description, benefitType, durationMonths?, maxRedemptions?, expiresAt? })` — generates 32-byte token via `crypto.randomBytes`, stores SHA-256 hash, **returns plaintext token exactly once** (shown in toast + copy button; never retrievable again).
- `adminListPlusOfferLinks()`, `adminDeactivatePlusOfferLink({ id })`, `adminListOfferRedemptions({ id })`.
- `claimPlusOfferByToken({ token })` (user-auth) → wraps RPC, returns result.

Routes:
- `src/routes/admin.plus.tsx` — campaign manager (list, create, deactivate, view redemptions, copy claim URL).
- `src/routes/claim.$token.tsx` — public claim page. If signed-out, redirect to `/login?redirect=/claim/<token>` (or `/signup?...`). If signed-in, shows "Claim Workshop Plus (Xmo / Lifetime)" button → calls RPC → shows success + link to profile. Handles already-claimed, expired, exhausted, invalid.
- Add `/admin/plus` nav item under "Revenue" group in `src/routes/admin.tsx`.

## Wave 4 — Stripe integration hardening

- New shared helper `src/lib/plus-benefits.server.ts` with `applyComplimentaryPlusBenefit({ userId, source, sourceId, benefitType, durationMonths, environment, note, grantedBy?, appliedToStripe? })` — the single write path (used by admin grants, offer redemptions, referral webhook, legacy comp). Handles stacking math (30-day months, from `max(now, latest active timed end)`).
- Refactor `src/lib/referrals.functions.ts` / referral webhook to call the helper instead of writing to `subscriptions` directly.
- Detect existing paid Stripe subscription before insert: if benefit_type=months AND paid sub currently active, mark grant `application_method='local_entitlement'` and stack after current period end (so it kicks in when Stripe lapses). If lifetime, insert with `application_method='lifetime_override'` and note that Stripe continues unless separately canceled.
- All existing entitlement checks already flow through `has_effective_plus` / `resolveEffectivePlusAccess` (Wave 1). Audit `src/lib/lounge-access.server.ts`, `src/lib/entitlements.functions.ts`, blog quota checks, `usePlus` consumers — no direct `subscriptions` reads for gating; leave `subscriptions` reads only in billing-management UI (`/settings/billing`).

## Wave 5 — Legacy migration

- Data migration (INSERT via insert tool, not schema): backfill one `plus_access_grants` row per historical `comp_memberships` where `status='redeemed'`, using `source='legacy_comp'`, `source_id=comp.id`, `benefit_type='months'`, `duration_months=comp.duration_months`, `access_starts_at=redeemed_at`, `access_ends_at=expires_at`, `status='active'|'expired'` based on `expires_at`.
- Refactor `src/lib/comp.functions.ts` `redeemCompMembership` to stop writing to `subscriptions`; instead call `applyComplimentaryPlusBenefit(source='legacy_comp', source_id=comp.id, ...)`. Keep the comp table for code lookup; entitlement flows via the ledger.
- Backfill script leaves `subscriptions` rows in place (Stripe-owned column stays authoritative for paid); the resolver already prefers lifetime > paid > timed.

## Wave 6 — Reporting & QA

- Add "Comp vs Paid revenue split" card to `/admin/revenue`: counts of active users by `source` (paid, complimentary, lifetime) from resolver over all users (batch query, not per-user).
- Add "Recent grants" table to `/admin/plus`.
- Mobile pass on new admin surfaces (already stacked flex, verify no overflow).
- Manual scenario checks documented in closing message:
  1. Admin grants 3 months to free user → Plus, ends in ~90 days.
  2. Admin grants lifetime to paid subscriber → resolver source='lifetime', Stripe untouched. Revoke lifetime → falls back to 'paid'.
  3. Two stacked 1-month grants → second stacks after first ends (60 days total).
  4. Offer link: create, copy URL, redeem while logged-out (redirect → login → auto-claim), attempt second redeem by same user (blocked), deactivate.
  5. Legacy comp code still redeems and grants Plus via ledger.
  6. Referral webhook still grants 1 month via helper.

---

**Technical notes**
- All admin server fns share a `requireAdmin(context)` helper that calls `context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' })` and throws 403 on false — no `supabaseAdmin` used to check admin status.
- Token: `crypto.randomBytes(32).toString('base64url')` → 43-char URL-safe. Hash: `crypto.createHash('sha256').update(token).digest()` (bytea).
- Environment default: `process.env.NODE_ENV === 'production' ? 'live' : 'sandbox'` read inside handler.
- All new tables ship GRANTs in the same migration per the public-schema rule.
- Notifications reuse existing `notifications` table shape.