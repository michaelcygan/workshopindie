# First-party moderation engine

Workshop already has three pieces we build on rather than replace:

- `src/lib/profanity.server.ts` — a small hardcoded slur list, only wired into 4 spots in `collab.functions.ts`.
- `public.moderation_terms` table + `admin-moderation.functions.ts` + `/admin/moderation` page — the admin can manage a lexicon, but nothing reads it at runtime.
- `public.mod_rules` — enable/threshold table with no readers yet.

The plan: promote the lexicon table to the source of truth, replace `profanity.server.ts` with a real engine that reads it, and call one server helper from every write path.

## 1. Data model changes (one migration)

Extend `moderation_terms`:
- `kind text not null default 'exact'` — `'exact' | 'phrase' | 'regex' | 'allow'` (allow = false-positive exception; suppresses a match).
- `category text not null default 'slur'` — `'slur' | 'threat' | 'harassment' | 'spam'` (informational; drives error category).
- `enabled boolean not null default true`.
- `updated_by uuid null references auth.users(id)`, `updated_at timestamptz default now()`.
- Trigger to stamp `updated_at`/`updated_by` on write.

Add `public.moderation_events` (audit + repeat-behavior signal):
```
id uuid pk, user_id uuid null, surface text not null, subject_id text null,
category text not null, rule_id uuid null, severity text not null,  -- 'block' | 'warn' | 'flag'
term_hash text null,                                                 -- sha256 of matched normalized term, never the term itself
excerpt_ciphertext bytea null, excerpt_nonce bytea null,             -- optional, admin-only, off by default
created_at timestamptz default now()
```
- RLS: `admins` full; users only see their own rows (for "you've been rate-limited" cooldown checks via RPC).
- GRANTs to `authenticated` (SELECT/INSERT via SECURITY DEFINER RPC only) and `service_role`.

Add SECURITY DEFINER RPC `moderation_recent_block_count(_user uuid, _window_s int) returns int` for rate-limit decisions without exposing the table broadly.

Seed `moderation_terms` from the existing SLURS constant in `profanity.server.ts` (kind='exact', category='slur', severity='block') plus ~30 common obfuscations as `kind='regex'`.

## 2. Shared moderation engine

New `src/lib/moderation/engine.ts` (isomorphic pure code — no imports of `client.server`):
- `normalize(text)`: NFKD → strip diacritics + zero-width chars (`\u200B-\u200D\uFEFF`) → Unicode confusables map (Cyrillic а→a, Greek ο→o, fullwidth Ａ→a, etc., small hand-curated table) → lowercase → leetspeak swaps (0→o, 1→i/l, 3→e, 4→a, 5→s, 7→t, @→a, $→s) → collapse repeats (`aaaa`→`aa`) → collapse punctuation/whitespace inside word boundaries. Keep `\s` between tokens so word boundaries still work for phrases.
- `compileMatcher(terms)`: returns `{ block: RegExp[], warn: RegExp[], allow: RegExp[] }` with word-boundary anchoring (`(?:^|\P{L})term(?:$|\P{L})/u`). `exact` → literal escaped + boundaries. `phrase` → same across whitespace. `regex` → trust admin input, wrap in try/catch and skip on failure.
- `check(text, matcher, opts)`: returns `{ ok: true } | { ok: false, severity, category, ruleId }`. Runs allow list first (returns ok if fully explained by allow), then block, then warn. Never returns the matched substring.
- `checkSpam(text, opts)`: link-count / mention-count / repetition heuristics; per-surface thresholds passed in.

New `src/lib/moderation/service.server.ts` (server-only wrapper):
- In-process cache of compiled matcher, TTL 60s, invalidated via a Postgres `LISTEN` or simpler: an integer `bumpVersion` RPC that admin write paths call. Cache keyed by version.
- `moderateForServer({ text, surface, userId, subjectId?, spamOpts? })` server-side helper:
  1. Load/reuse compiled matcher.
  2. Run `check` + `checkSpam`.
  3. On block/warn: insert `moderation_events` row (fire-and-forget with `service_role` via `supabaseAdmin` loaded inside the function), including `term_hash` only (no raw term). Bumps a per-user counter used by cooldown.
  4. If user has ≥5 blocks in last 10 min → escalate this attempt's severity to `flag` and shorten posting cadence (server refuses with generic "please slow down" for 5 min). Numbers configurable via `mod_rules`.
  5. Return `{ ok, category, message }` — message is generic ("This can't be posted because it contains language prohibited by Workshop's community standards. Please revise it and try again." + optional category).

New server fn `getModerationClientBundle` (public, cached) returns a compact JSON snapshot the browser can compile locally for pre-check UX only — includes only the `enabled` patterns with severity/category, no notes. Client cache keyed by `version` field; refetched with `staleTime: 5 min`. This is the "safe cached representation" — losing it can't bypass the server check.

New `src/lib/moderation/client.ts`:
- `useModerationChecker()` hook: fetches bundle once via TanStack Query, memoizes compiled matcher, exposes `check(text): { ok, category }` synchronously.
- Pure client-side warning UI only. Never treats client "ok" as authorization.

## 3. Wire the engine into every write path

Central helper `moderateOrThrow(context, surface, text, opts?)`: throws a typed `Error` whose message is the generic user-facing string. Called at the top of each affected `.handler(...)`. Applied to (grouped by file):

- `comments.functions.ts` — replyToComment already exists; add engine call. Extend to a new `postComment` server fn (front-end today writes directly to `supabase.from("comments")` — direct writes bypass moderation, so we add an RLS restriction below and switch the client to the server fn).
- `dms.functions.ts` — `sendMessage`.
- `chat.functions.ts`, `today-chat.functions.ts`, `instant.functions.ts`, `host-room.functions.ts`, `lobby.functions.ts` — every message/pin/welcome insertion.
- `works.functions.ts`, `works-import.functions.ts` — `title`, `description`, `excerpt`, credit `role_label`/`display_name`. Both create and edit paths.
- `collab.functions.ts` — extend existing `findHateSlur` call sites to `moderateOrThrow` (title, description, roles, requirements, application message).
- `collab-publish.functions.ts`, `collab-workshop.functions.ts` — publish gate.
- `groups.functions.ts`, `group-admin.functions.ts`, `group-events.functions.ts`, `group-events-admin.functions.ts`, `group-news.functions.ts` — name, description, posts, event fields, updates, comments.
- `event-companion.functions.ts`, `event-showcase.functions.ts`, `event-photos.functions.ts` (captions), `event-import.functions.ts`, `event-short.functions.ts` — captions/notes only.
- `workshop-*.functions.ts` — messages, doc titles, poll questions/options, task titles, tool item labels.
- `account.functions.ts`, `me.edit.tsx` server fns — `display_name`, `username`, `headline`, `bio`, `pronouns`, city.
- `notifications-prefs.functions.ts` — none (no free text).
- `admin-moderation.functions.ts` — admin term/rule writes bump lexicon version and log via existing `logAdminAction`.
- `friends.functions.ts` / follow request notes if any.
- `share.functions.ts`, `referrals.functions.ts` — any free-text captions.

**Publish gate for drafts:** `works.$slug.edit.tsx` and `collab.$slug.edit.tsx` allow saving drafts freely; the transition-to-published server fn (`publishWork`, `publishCollab`) re-runs moderation on the full record. If a term is added later, drafts stay drafts.

**RLS clamp so direct writes can't bypass:** for `comments`, `messages`, `instant_messages`, `workshop_messages`, `group_today_posts`, `group_event_comments`, `event_photos`, `event_showcase_items`, `group_news`, and `reports` — replace the `INSERT` policy so it only permits `body/text` when a matching server-side moderation event row exists for the caller within the last few seconds; simplest form: keep INSERT open but add a `BEFORE INSERT` trigger that calls a SECURITY DEFINER function `assert_moderated(text, surface)` which checks the pre-registered moderation ticket. **Simpler and preferred:** switch these tables to `TO service_role` INSERT only and route all inserts through server fns (they already exist for most; add ones missing — notably `comments`, `event_photos captions`, `group_today_posts`). This is the "smallest reliable server-side enforcement" for our stack.

Client changes: swap the ~6 direct `supabase.from(...).insert(...)` UGC sites for their server-fn equivalents. No visual change.

## 4. Rate limiting / repeat behavior

Reuse the existing `rate_limits` table + `check_and_bump` RPC (already used in `dms.functions.ts`). Per-surface budgets, e.g.:
- comments: 8/min, 40/hour
- messages: 30/min
- lounge chat: 60/min
- long-form (works/collabs/groups/events publish): 6/hour
- `mod_block`: any block increments a per-user counter; ≥5 in 10 min → 5-min posting cooldown (server-enforced, generic message).

All checked server-side. Buttons may show a disabled state, but the source of truth is the RPC.

## 5. UX

Reusable `ModerationError` class with `.category` and `.userMessage`. Server fns throw it; call sites (existing `toast.error(e.message)` patterns) show the message unchanged. Preserve text in editors — every current UGC form already keeps state on error (no clearing on catch); explicitly confirm this in each edit-form file and, where a form does clear, remove the reset-on-error.

Inline error prop threaded into the existing `Input`/`Textarea` field affected: use `aria-invalid` + a `<p role="alert">` sibling with the category message so screen readers pick it up. No color-only signaling.

No repetition of the offending term. No exposure of matcher internals.

## 6. Admin UI (extend `/admin/moderation`)

Add tabs to the existing page:
- **Terms** (existing) — add `kind`, `category`, `enabled` toggle columns; add "Allowlist" section using `kind='allow'`. Show `updated_by`/`updated_at`. Bumps lexicon version on save.
- **Events** — paginated list from `moderation_events` filtered by surface/category/user; shows term hash + category + severity + count; drill-in shows the sanitized excerpt only if the admin explicitly requests decryption (`show excerpt` button — decrypts server-side via a fn that also logs the peek to `admin_audit_log`).
- **Rules** (existing) — surface-scoped rate-limit knobs; edits publish via `check_and_bump` config load.

## 7. Tests

Add `src/lib/moderation/engine.test.ts` (bun + vitest already in project). Cases exactly as spec:
- exact term, mixed case, punctuation-separated (`n.i.g.g.e.r`), zero-width injection, Cyrillic а confusable, leet variants, phrase across newline.
- False positives: `Scunthorpe`, `classic`, `assassin`, `analysis`, `bass`, `hello@example.com`, URLs containing `ass`.
- Allowlist entry overrides.
- Ordinary profanity (`fuck`, `shit`) → allowed.
- Educational quoting → allowed when wrapped by allowlisted phrase pattern (documented limitation otherwise).
- Multi-lingual valid text (Japanese, Arabic, Cyrillic non-slur).
- Spam heuristics: 6 links → warn, same link ×3 → block.
- `moderateOrThrow` unit test per surface (mock supabase).

## 8. Scope explicitly out

- No image/OCR/audio/video moderation. Media still flows through existing report system.
- No auto-ban. Repeat threshold reaches admin flag only.
- No lexicon delivered to client in raw form beyond enabled compiled patterns needed for pre-check UX; the same patterns exist in the DB accessible only to admins.

## Files changed

Migration (1). New: `src/lib/moderation/{engine.ts,service.server.ts,client.ts,engine.test.ts}`. Edit: `profanity.server.ts` (replace body with re-export from engine — or delete after callers migrated), `admin-moderation.functions.ts`, `/routes/admin.moderation.tsx`, plus every `.functions.ts` listed in §3 (~25 files, one added helper call each), plus ~6 UGC form components to switch from direct-insert to server-fn.

## Report shape (delivered after implementation)

Will list: protected surfaces, server enforcement points, normalization steps, false-positive strategy, hard-block vs flag categories, repeat-abuse handling, admin workflow, DB changes, files/tests changed, known limits.
