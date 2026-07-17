## Two mobile polish + edit-flow additions

### 1. Tighten mobile spacing below Featured (`src/routes/u.$username.tsx`)

Goal: shave vertical space between the identity block, Featured carousel, and the tabs bar on mobile only. Desktop spacing unchanged.

- Aliases row: `mt-2 … md:mt-3` → `mt-1.5 … md:mt-3`.
- Artist statement blockquote: `mt-3 … md:mt-8` → `mt-2 … md:mt-8`.
- Featured wrapper (line ~720): `mt-6 md:mt-8` → `mt-3 md:mt-8`.
- `PinBar` (line ~1019): outer `mb-6 md:mb-8` → `mb-3 md:mb-8`; heading `text-lg` → `text-base md:text-lg`; scroller `mt-2 … md:mt-3` → `mt-1.5 … md:mt-3` and reduce `pb-2` → `pb-1`.
- Tabs sticky wrapper (line ~730): `mt-4 … md:mt-6` → `mt-2 … md:mt-6`.

No desktop `md:` values change. No layout or content restructure.

### 2. Link a website to each artist alias

Data model — add a parallel `alias_urls text[]` on `profiles` (aliases stay `text[]`, index-aligned):

- Supabase migration:
  - `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS alias_urls text[] NOT NULL DEFAULT '{}'::text[];`
  - Existing profile grants already cover the column; no new GRANT/RLS work.

Edit flow — `src/routes/me.edit.tsx`:

- Add `aliasUrls: string[]` to `FormState` and `EMPTY`.
- Load `alias_urls` alongside `aliases` (pad/trim to match `aliases.length`).
- In the aliases card, render a small second input under each alias row:
  - `Website (optional)` — `type="url"`, `placeholder="https://…"`, `maxLength={200}`.
  - When adding/removing an alias, keep `aliasUrls` in lockstep (push `""` / splice same index).
- On submit, after computing `cleanAliases`:
  - Build `cleanAliasUrls` at the same indices; trim; if non-empty and missing scheme, prepend `https://`; validate via `new URL(...)` in a try/catch — invalid → `""`.
  - Truncate to `cleanAliases.length`.
  - Persist as `alias_urls: cleanAliasUrls` in the `profiles.update({...})` call.

Public profile — `src/routes/u.$username.tsx`:

- Add `alias_urls` to the profile SELECT list.
- Add `alias_urls: string[] | null` to the profile type.
- In the aliases render block, use `alias_urls?.[i]`:
  - When a non-empty URL exists, render an `<a href={url} target="_blank" rel="noopener nofollow ugc">` styled like today's chip, with a subtle hover underline and a tiny `ExternalLink` icon (h-3 w-3) after the label; block-list check via existing `render-links` helpers is not required for user-owned profile links but reuse the existing `LinkPills` sanitizer if it exposes one — otherwise a plain absolute URL check is fine.
  - Otherwise keep the current `<span>` chip.

Constraints: reuse the established save flow (single `profiles.update`), no new server functions, no schema changes to `aliases` itself, no join tables.

### Files touched

- `src/routes/u.$username.tsx` — spacing tweaks + alias link rendering + SELECT column + type.
- `src/routes/me.edit.tsx` — `aliasUrls` in state, per-row URL input, save normalization.
- `supabase/migrations/<new>.sql` — add `alias_urls text[]` to `profiles`.
