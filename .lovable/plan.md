## What's happening

The bottom island menu links to `/collab` and `/events`. Both routes validate their URL search params with a Zod schema, and both crash with the same Zod v4 error:

```
[
  { "code":"invalid_type","expected":"nonoptional","path":["city"] },
  { "code":"invalid_type","expected":"nonoptional","path":["cityName"] }
]
```

## Root cause

`@tanstack/zod-adapter@1.167` (peer-declares `zod ^3`) ships this helper:

```ts
export const fallback = (schema, fallback) =>
  z.custom().pipe(schema.catch(fallback));
```

The project uses `zod@4.4.3`. In Zod v4, an object field is only treated as optional if its **outermost** schema is `.optional()`/`.default()`. `fallback(...)` wraps the inner schema in `z.custom().pipe(...)`, so the outermost is `ZodPipe`, not `ZodOptional`. When the URL has no `city`/`cityName` param, Zod v4 sees a missing required field and throws `expected: "nonoptional"`.

It only shows up on `/collab` and `/events` because those are the only routes whose `fallback(...)` fields use `.optional()` without `.default()`. The other `fallback(...)` calls in `groups.index.tsx` and `gallery.tsx` all chain `.default(...)`, which sidesteps the bug.

## Fix

Bypass the broken adapter helper for the optional fields — build the schema directly so `.optional()` stays on the outside:

`src/routes/collab.index.tsx` (lines 27-28) and `src/routes/events.index.tsx` (lines 32-33):

```ts
// before
city:     fallback(z.string().uuid().optional(), undefined),
cityName: fallback(z.string().optional(), undefined),

// after
city:     z.string().uuid().catch(undefined).optional(),
cityName: z.string().catch(undefined).optional(),
```

Same runtime behavior (bad value → `undefined`; missing → `undefined`), but the field is genuinely optional under Zod v4.

## Not doing

- No package changes. Upgrading/downgrading `@tanstack/zod-adapter` or `zod` would ripple through the whole app; a two-file schema tweak is safer and matches the pattern already used elsewhere.
- Leaving `fallback(...)` in place for the `.default(...)` fields — they aren't affected.

## Files

- `src/routes/collab.index.tsx` — swap the two optional field schemas.
- `src/routes/events.index.tsx` — swap the two optional field schemas.