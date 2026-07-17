## Problem

Published-site worker logs show:

```
Error: Server function info not found for fetchGroupNews
GET /_serverFn/fetchGroupNews → 500
```

Preview works; production 500s. Root cause matches the documented failure mode: `src/lib/group-news.functions.ts` imports `supabaseAdmin` from `@/integrations/supabase/client.server` at **module scope**. Server-function modules only strip handler bodies from the client bundle — top-level imports remain in the client graph, and the router's import-protection on `.server.*` files breaks the production server-fn manifest, so the deployed worker can't resolve `fetchGroupNews`.

Separately, the marquee currently uses `durationSec = Math.max(90, items.length * 14)` — user wants scroll speed halved.

## Changes

**1. `src/lib/group-news.functions.ts`** — move admin client to a lazy import inside the handler.

- Remove top-level `import { supabaseAdmin } from "@/integrations/supabase/client.server"`.
- Inside `.handler(...)`: `const { supabaseAdmin } = await import("@/integrations/supabase/client.server");` before the `.from("groups")` call.
- Everything else unchanged.

This restores the server-fn manifest entry on the published worker so `/_serverFn/fetchGroupNews` returns 200.

**2. `src/components/group/group-news-ticker.tsx`** — halve scroll speed.

- Change `const durationSec = Math.max(90, items.length * 14);` to `const durationSec = Math.max(180, items.length * 28);` (double the duration = half the speed).

## Verification

After deploy: hit `/g/chicago` on workshopindie.com, confirm the ticker renders and headlines scroll at ~half the previous pace. Check worker logs — no more "Server function info not found".
