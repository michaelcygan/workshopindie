# Tighten the avatar "more" menu + reorganize Settings

The avatar dropdown today mixes identity (My profile), top-level nav (Drop in, My Collabs, Network, My Events), a Create shortcut (Post a Collab — already in the orange **+ Create** next to it), upsell (Go Plus, Refer & Earn), and account utilities (Settings, Admin, Sign out). It's long and duplicates the Create button and the main nav.

## Avatar dropdown — desktop (`top-nav.tsx`)

```text
┌─────────────────────────────┐
│  Greg Anderson              │   ← header row: avatar + name + @handle
│  @gregando                  │      whole row links to /u/$username
├─────────────────────────────┤
│  ◐  My stuff           ▸    │   ← submenu: My Collabs, Network, My Events,
│                                                  Refer & Earn
├─────────────────────────────┤
│  ✦  Go Plus / Plus ✓       │   ← label flips on usePlus(); → /pricing or /settings#plus
│  ⚙  Settings                │
├─────────────────────────────┤
│  🛡  Admin                  │   ← only when isAdmin
│     Sign out                │
└─────────────────────────────┘
```

Changes vs. screenshot:
- Remove **My profile** row (header becomes the link).
- Remove **Drop in** (Workshop is already in the main top nav).
- Remove **Post a Collab** (lives in the adjacent **+ Create** menu).
- Group **My Collabs / Network / My Events / Refer & Earn** under a single "My stuff" submenu (`DropdownMenuSub`).
- Collapse Plus into one row: "Go Plus" for free, "Plus ✓ — Manage" for Plus users.
- Settings → opens Account section by default.

## Avatar sheet — mobile (`mobile-nav.tsx`)

Flat list (no submenu):

```text
Greg Anderson  @gregando
─────────────────────────
My Collabs
Network
My Events
Refer & Earn
─────────────────────────
Go Plus / Manage Plus
Settings
─────────────────────────
Sign out
```

Remove Post a Collab and the Drop-in equivalent. Keep Messages only if there's no other entry point on mobile (verify during build).

## Settings reorganization (`src/routes/settings.tsx`)

Collapse the sidebar from 8 → 6 rows:

```text
Account          ← identity, email, password, connected sign-ins, language, default city
Plus membership  ← plan, renewal, manage billing, cancel/resume, upgrade CTA
Notifications
Privacy          ← existing privacy + GDPR/age controls
Safety           ← Blocked users + My reports (merged)
Your data        ← Export data + Delete account (merged)
```

### Account section — add

- **Change email** (Supabase `updateUser({ email })`, triggers confirmation).
- **Change password** (existing `resetPasswordForEmail` flow or inline `updateUser({ password })`).
- **Connected sign-in methods** (display Google if linked; read-only for now).
- **Default city** — autocomplete using existing `cities.functions.ts`; persisted to `profiles.default_city_id` (verify column exists during build — if not, add a one-column migration with the standard GRANTs).
- **Language** — single select (start with English; structure the field so future languages can plug in). Persisted to `profiles.preferred_language` (add column + GRANTs if missing). Will later feed a Workshop language filter.

### Plus section — flesh out

- Current plan + renewal/cancel-at date from `usePlus()`.
- "Manage billing" → existing `createPortalSession`.
- Cancel / Resume buttons (Stripe portal handles, but expose top-level buttons).
- Upgrade CTA for free users → `/pricing`.

### Safety + Your data

- Just merges the existing `blocked`, `reports`, `data`, `danger` sections under two parent IDs. No new server functions.

## Files touched

- `src/components/top-nav.tsx` — rewrite avatar `DropdownMenuContent`; add `DropdownMenuSub` for "My stuff".
- `src/components/mobile-nav.tsx` — rewrite "You" dropdown rows.
- `src/routes/settings.tsx` — collapse `SECTIONS` (8 → 6), add Account inline actions, expand Plus section, merge Safety + Your data.
- Possibly a single migration adding `profiles.default_city_id` (FK → `cities.id`) and/or `profiles.preferred_language` (text, default `'en'`) **only if** those columns don't already exist. Standard `GRANT`s + RLS update for owner write.

No route additions, no new server-function files (reuses `account.functions.ts`, `payments.functions.ts`, `cities.functions.ts`).
