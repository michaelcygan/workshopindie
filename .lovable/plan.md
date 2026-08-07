# Waves 8 and 9 — Presence policy, then finishing the taxonomy migration

Same rules as the earlier waves: product, design and navigation stay frozen. These are under-the-surface changes with typecheck, tests and a build between them.

## Wave 8 — One presence policy

### What's there now

Every signed-in tab runs a 60-second heartbeat that calls `pingPresence`. Each beat does two service-role writes against `profiles`: a read of the current row, then an unconditional `UPDATE profiles SET last_active_at = now()`. Three tabs open means six `profiles` writes a minute, per person, forever — on the same table that backs profile pages, search and admin lists. "Online" is then computed as `last_active_at` within two minutes.

That works fine today and gets expensive in exactly the way the audit predicted: write amplification on a hot, widely-read table that scales with open tabs rather than with people.

### The two tiers

**Ephemeral tier — "who is online right now."** Presence stops being a `profiles` write. The heartbeat moves to a dedicated lightweight presence store keyed by user, holding only last-seen time and the online-visibility flag. Rows expire; nothing about it is durable or historical. The friends list, green dots and any "online now" count read this tier.

**Durable tier — "when was this person last around."** `profiles.last_active_at` stays exactly as a column and keeps its current meaning for admin and analytics, but is written on session boundaries (sign-in, sign-out) and at most once per configurable interval — a coarse timestamp, not a per-minute pulse.

### Changes

- Heartbeat interval and write behaviour become one named policy in a single module, not numbers scattered across a component and a server function, with the "came online" threshold alongside them.
- `pingPresence` collapses to a single upsert into the ephemeral tier. The read-then-write pair goes away; the "did they just come online" decision is made from the returned prior value rather than a separate select.
- The "friend came online" notification keeps today's behaviour: opt-in, mutuals only, only after a real absence. It now routes through the Wave 7 `notify` service, which already gives it dedupe.
- Durable `last_active_at` is updated from the same call path, throttled to the coarse interval, so admin "last active" columns keep working with no code change on their side.
- The heartbeat backs off when the tab is hidden and resumes on focus, and stops entirely on sign-out.

Before choosing the intervals I'll measure the current write rate rather than guess, and record the chosen numbers in the module.

Risk: low. Everything is behind one policy module; reverting means restoring the old interval and write target.

## Wave 9 — Finish the taxonomy migration

### What's there now

`src/lib/taxonomy.ts` is already the canonical source of truth: twelve canonical categories, with normalization at the display and filter boundary. Its own header states the compromise — the database still stores two separate legacy enums, `category` for works/collabs/profiles and `group_category` for groups, and no stored values have been rewritten.

So labels no longer drift, but every read still pays a translation, and two enums can disagree about what exists.

### Approach

Staged, so no single migration both rewrites data and changes behaviour:

1. **Inventory.** Every stored representation of a creative category across tables, enums, RPCs, triggers, indexes and seeds, with real reference counts — including blog categories and any singular/plural field drift. Written down before anything moves.
2. **Decide the final stored form** — one canonical set, with the community-only categories (city, scene life, language) explicitly marked as valid for Groups and not for Works and Collabs, matching what the taxonomy module already encodes.
3. **Add, don't swap.** New canonical storage lands alongside the legacy columns, backfilled and kept in sync by trigger, so old and new reads agree at every moment.
4. **Move reads over** to the canonical column, with the compatibility mapping still in place as a safety net.
5. **Drop legacy columns and enums in a later, separate migration**, only once nothing references them — not in this wave.

Steps 4 and 5 are where filtering, group category chips, medium-group auto-linking and category placeholder art could regress, so each gets a check against real rows before moving on.

Risk: medium, which is why the destructive step is deliberately deferred past this wave.

## Technical notes

- Presence policy lives in one module consumed by both the client heartbeat and the server function; the ephemeral store is a narrow table with its own RLS, readable only for visibility-enabled users, plus an expiry sweep on the existing cron path.
- `profiles.last_active_at` is not dropped, renamed or changed in meaning — only in write frequency — so admin panels, analytics and the users directory are untouched.
- Taxonomy work adds columns and triggers only; the legacy enums remain droppable later, and `taxonomy.ts` stays the single authority throughout.
- Tests: presence policy thresholds and the came-online decision; taxonomy normalization round-trips for both legacy enums, including the community-only cases.

## Not in these waves

No presence UI changes, no green dots where there aren't any today, no new realtime channels, no category renames or additions visible to users, and no dropping of legacy columns.
