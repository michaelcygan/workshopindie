## Root cause

`src/lib/today-chat.functions.ts` is a `.functions.ts` module that declares module-scope helpers and constants:

- `BODY_MAX`, `MENTION_RE`, `MENTION_CAP`, `TZ_RE`
- `extractMentions()`

…and the `.handler()` body references `TZ_RE` and `extractMentions()` directly.

TanStack Start's `?tss-serverfn-split` transform emits a server-only module that keeps ONLY the `createServerFn` chain — sibling module-scope declarations are stripped. At runtime the handler hits `TZ_RE`/`extractMentions` and throws `ReferenceError`. The mutation catches it, clears the input via `onSuccess`… no — `setBody("")` runs on success only, but the toast for the thrown error can arrive with an empty/opaque message when it crosses the RPC boundary as a `ReferenceError`, so the user sees the input clear (from `disabled` styling flicker + no visible toast) and no post. The two successful posts from earlier today were created before this file grew the tz/mention helpers.

The database side is fine (INSERT policy passes for this user; `is_adult` returns true; `expires_at` is populated by the RPC).

## Fix

Move the helpers and constants out of the `.functions.ts` module into a server-only sibling, then import them.

**New file** `src/lib/today-chat.server.ts`:
- Export `BODY_MAX`, `MENTION_CAP`, `TZ_RE`, `extractMentions`.
- Move the `MENTION_RE` regex here as well (kept private to the helper).

**Edit** `src/lib/today-chat.functions.ts`:
- Replace the module-scope helpers with an `import { BODY_MAX, TZ_RE, extractMentions } from "./today-chat.server"`.
- Handler body unchanged in behavior, but now references only imports and locals — safe under the split transform.
- `inputValidator` uses `BODY_MAX` from the import (input validators are bundled with the server fn, but keeping this consistent).

No schema, RLS, UI, or notification changes. No behavior changes for the client — the same server fn signature and return shape.

## Out of scope
- Reworking the mutation's error toast (real error surface returns after the split fix).
- The `expires_at` fallback / UTC path — already handled correctly.