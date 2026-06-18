## Finish the launch-readiness pass

Pick up exactly where we left off after the security migration + HIBP. Three focused workstreams, one PR each.

### 1. Realtime RLS (the last critical security blocker)

Map every `realtime.messages` topic in use and write per-topic policies.

Topics in the codebase (from `rg "channel\("` and `topic:`):
- `workshop:{id}` — gate by `workshop_participants` membership OR `host_user_id`
- `instant:{roomId}` — gate by `instant_presence` membership
- `dm:{conversationId}` — gate by `conversations` participant columns
- `notifications:{userId}` — gate by `auth.uid() = userId`
- `presence:*` — broadcast-only; allow authenticated SELECT but block private payloads via topic-name check

One migration: enable RLS on `realtime.messages`, add SELECT/INSERT policies per topic prefix using `split_part(topic, ':', 1)` + membership lookups. Smoke-test live workshop, DM, notification bell after.

### 2. SECURITY DEFINER function audit

Scanner flagged ~30 definer functions executable by `anon`/`authenticated`. Most are RLS helpers (`has_role`, `is_workshop_member`, etc.) and must stay callable. Pass:

- List every definer function, classify as **RLS-helper** (keep grants) or **RPC** (intentional client call) or **internal** (`REVOKE EXECUTE FROM anon, authenticated`).
- One migration with the REVOKEs for the internal set.
- Move `extensions` out of `public` schema if low-risk (pgcrypto/uuid-ossp are safe to relocate; skip if any policy references them unqualified).

### 3. SEO + per-route `head()` sweep

- Trigger `seo--trigger_scan`, read findings.
- Add `head()` to public dynamic routes missing per-page metadata. `seo-loaders.functions.ts` already exposes `getWorkSeo`, `getProfileSeo`, `getWorkshopSeo`, `getCitySeo` — wire them into loaders and `head()` on:
  - `/works/$slug`
  - `/u/$username`
  - `/workshops/$slug`
  - `/cities/$slug`
  - `/g/$slug` (add a `getGroupSeo` loader)
  - `/collab/$slug` (add a `getCollabSeo` loader)
- Each leaf: title, description, og:title, og:description, og:url, canonical, og:image when a cover exists.
- Mark findings fixed.

### 4. UI activity sweep (blockers only, no redesigns)

Targeted fixes only — no visual overhaul.

- **404 coverage**: confirm `notFoundComponent` on `/u/$username`, `/works/$slug`, `/g/$slug`, `/collab/$slug`, `/workshops/$slug`, `/cities/$slug`. Add where missing.
- **Empty states**: gallery filter-combo empty, `u/$username` empty profile, `me.tickets`/`me.collabs` empty, "For You" cold-start fallback.
- **Mobile a11y**: `aria-label` on icon-only buttons in `top-nav`, `mobile-nav`, `notifications-bell`, `messages-inbox-button`, `work-actions`, room toolbars. Tap targets ≥44px on mobile nav.
- **Toast consistency**: one success/error/info variant; sweep `toast.error`/`toast.success` calls for stray defaults.
- **Loading skeletons** on `/gallery`, `/`, `/workshop`, `/u/$username` (replace bare spinners only where present).
- **Image alt fallback** to work title on user-uploaded covers.

### 5. Final smoke pass

After publish:
- Sign up → onboarding → create workshop → join from second account.
- Hard-refresh on a protected route (no auth loop).
- DM send/receive.
- Live room join + tools panel switch.
- 4 public dynamic routes return 404 for bad slugs.
- Console + network sweep on published URL.

### Out of scope (unchanged)

Performance pass, analytics, onboarding rewrite, branded Google consent screen, `group_event_lineup_slots` visibility decision.

### Order of operations

1. Realtime RLS migration (security blocker — first).
2. Definer audit migration.
3. SEO scan + per-route `head()` wiring.
4. UI sweep.
5. Publish + smoke.
