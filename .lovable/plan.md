# Workshop Free/Plus Entitlements Overhaul

Consolidate entitlement rules, replace the daily Lounge cap with a monthly one, add a 2/month Free Blog publication quota, and clean up all stale premium copy. Ship in 6 sequential waves; stabilize (typecheck + smoke) before advancing.

## Wave 1 — Central entitlements + copy cleanup

**New:** `src/lib/entitlements.ts` — client/server-safe constants + `WorkshopEntitlements` type + `resolveEntitlements(subscription)` pure fn.

```
FREE_PUBLISHED_WORK_CAP = 10
FREE_OPEN_COLLAB_CAP = 2
FREE_LOUNGE_MINUTES_PER_MONTH = 600
FREE_BLOG_PUBLICATIONS_PER_MONTH = 2
```

- Unlimited = `null` (never sentinel numbers).
- Free applies to: no sub, canceled, expired, lapsed, past_due beyond grace.
- Plus applies to: `active` or `trialing` with future `current_period_end`.

**Deprecate:**
- `FREE_LOUNGE_MINUTES_PER_DAY`, `useLoungeMinutesToday`, `lounge_minutes_today` RPC callers (keep RPC one release, unused).
- Home-city gating, "all cities" Plus benefit, priority seats, boosted placement, Plus profile badge, Credits strip, work analytics, premium Lounge hosting, saved setups, "Galleryhop Plus", "1 blog draft", "30 min / day".

**Sweep** (rg): `use-plus.tsx`, `pricing.tsx`, `settings.tsx`, `me.blog.*`, `plus-gate*`, `blog-access.server.ts`, blog editor, Lounge entry, metadata `head()`.

**Keep untouched:** Founding / Verified / City Host / Admin badges, moderation, Stripe pipeline.

**Exit:** typecheck green; no visual redesign; no behavior change to quota yet (still enforces old caps).

---

## Wave 2 — Free Blog: 2 publications / UTC month

**Migration:**
- Add `blog_posts.first_published_at timestamptz` (nullable); backfill = `min(published_at)` where currently published. Trigger: set once when a post transitions `is_published false → true` and `first_published_at is null`. Never overwritten.
- RPC `publish_blog_post(_post_id uuid) returns json` — `SECURITY DEFINER`, `search_path=public`. Takes an advisory lock on `hashtext('blog_publish:' || auth.uid())`, counts `first_published_at` in `[date_trunc('month', now() at tz 'UTC'), +1 month)` for that author, enforces limit unless writer-access mode ∈ {plus, granted}, flips `is_published` and sets `first_published_at` atomically. Returns `{ok, published_this_month, remaining, period_start, period_end}` or `{error:'quota_exhausted', ...}`.
- GRANT EXECUTE to authenticated.

**Server:** `resolveBlogAccess` extended to include `monthlyPublishLimit`, `publishedThisMonth`, `remainingPublications`, `periodStart`, `periodEnd`. `plus`/`granted` → limit `null`. `free`/`trial` → limit 2. `lapsed`/`suspended` unchanged. `blog.functions.ts` publish path calls the RPC and maps structured errors.

**Client:** Blog dashboard shows `1 of 2 free Blog publications used this month` / at-limit copy. Publish button routes to `<PlusGate reason="blog_limit">` only when a first-time publish would exceed. Drafts / edits / unpublish / republish never blocked. Delete never restores slot (no state change).

**Tests** (vitest, RPC via seeded fixtures): first pub, second pub, third rejected, edit no-consume, republish no-consume, delete no-restore, plus unlimited, lapsed = free, suspended blocked, concurrent (two parallel calls → one 200 one quota_exhausted).

---

## Wave 3 — Lounge: 600 min / UTC month, server-authoritative

**Migration:**
- `lounge_audio_sessions(id, user_id, room_id, provider, started_at, ended_at, status, created_at)`.
- `lounge_audio_usage_minutes(user_id, session_id, room_id, minute_bucket timestamptz, provider, created_at, unique(session_id, minute_bucket))`.
- RLS: user reads own rows; only service role writes. Grants per project convention.
- RPC `lounge_audio_start(_room_id, _provider) returns json` — resolves entitlement, counts distinct `minute_bucket` for user in current UTC month, rejects if free ≥ 600, else inserts session + first minute, returns `{session_id, minutes_used, minutes_remaining}` or `{error:'quota_exhausted'}`.
- RPC `lounge_audio_heartbeat(_session_id) returns json` — validates session belongs to caller and is open, upserts current `date_trunc('minute', now())` bucket (idempotent via unique constraint), re-checks free cap and returns `{minutes_used, minutes_remaining, must_disconnect}`.
- RPC `lounge_audio_end(_session_id)` — sets `ended_at`, `status='ended'`.
- `sweep_stale_lounge_audio_sessions()` cron 1/min: close sessions with no heartbeat > 3 min.

**Server fns:** `src/lib/lounge-audio-usage.functions.ts` wraps the three RPCs with `requireSupabaseAuth` (derives `user_id` from context — never trust client). Stream token issuance (`stream-video.functions.ts`) calls `lounge_audio_start` first; if quota_exhausted, refuses token. Mesh path adapter (`use-mesh-lounge-audio.ts`) uses the same start gate — no unmetered fallback.

**Client:** New hook `useLoungeUsageThisMonth()` returning the shape in the spec, backed by `supabase.from('lounge_audio_usage_minutes').select('minute_bucket', {count:'exact', head:true}).eq('user_id',me).gte(...)` + `usePlus`. Provider adapters (`use-stream-lounge-audio.ts`, `use-mesh-lounge-audio.ts`) heartbeat every 30s while `joined`; on `must_disconnect` or 401 quota: disconnect audio only, keep chat, show sheet, do not sign out. On successful `openCheckout` → Plus webhook, `queryClient.invalidateQueries({queryKey:['subscription']})` and `['lounge-usage']`; provider allows immediate rejoin.

**UI copy:** low-profile indicator on Lounge entry + Settings Plus section, warnings at 80% / 10 min / 0 min per spec.

**Tests:** connection below cap, listener + speaker both count, chat-only doesn't count, duplicate heartbeat unique-constraint dedup, reconnect same room preserves total, block at 600, chat still usable, Plus unlimited, upgrade unlocks in-session, month rollover.

---

## Wave 4 — Pricing page, PlusGate variants, Settings

- Rewrite `src/routes/pricing.tsx` copy per spec (no visual redesign). Keep `plus_monthly` and embedded checkout.
- `src/components/plus-gate.tsx`: add `reason: PlusGateReason` prop; render the four titled messages + shared footer. Update every call site (work create, collab create, blog publish, lounge limit sheet) to pass a reason.
- `src/routes/settings.tsx`: fix any "Galleryhop" wording, render Free vs Plus states per spec, embed Lounge + Blog usage rows for Free members via the new hooks.
- Remove Plus badge rendering on public profile (`u.$username.tsx`) if present (keep creator-status badges).
- Update `head()` metadata on `/pricing`, `/`, blog, settings that mentions old benefits.

---

## Wave 5 — Payment hardening

- `src/lib/payments.functions.ts`: `const ALLOWED_PRICE_LOOKUP_KEYS = ['plus_monthly'] as const;` — validator rejects anything else.
- Audit webhook (`api/public/payments/webhook.ts`): confirm idempotency (already `upsert onConflict stripe_subscription_id`), env-scoped writes, `active`/`trialing`/`canceled` → mapped to tier per Wave 1 resolver. No new products.
- Confirm `usePlus` never returns true from cache before subscription row confirms; add `staleTime: 0` on invalidation after checkout return.

---

## Wave 6 — Repo-wide audit + release checks

- `rg` sweep for the exact terms listed in the spec; each match either updated or annotated as intentional.
- Manual walkthrough checklist across the surfaces listed.
- Full typecheck; run vitest suites added in W2 + W3; Playwright smoke: publish 3rd free blog blocked, join Lounge at cap blocked, upgrade → rejoin works.

## Technical notes

- All UTC month boundaries: `date_trunc('month', now() at time zone 'UTC')`.
- Concurrency in W2 uses `pg_advisory_xact_lock(hashtext('blog_publish:'||auth.uid()))` inside the RPC transaction.
- Heartbeat idempotency uses the `(session_id, minute_bucket)` unique constraint + `on conflict do nothing`.
- Never delete stripe/webhook code or the mesh adapter — mesh must respect the same quota, not be removed.
- Every migration ships with GRANTs immediately after CREATE TABLE per project rule.
- No new subscription product, no annual tier, no changes to trial length.

## Report after each wave

Files changed · migrations added · entitlement/quota logic introduced · tests run · remaining inconsistencies · deferred decisions.