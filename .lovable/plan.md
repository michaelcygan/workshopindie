## What's happening

Yes — the event page is already built at `src/routes/g.$slug.e.$eventSlug.tsx` and it renders correctly on a hard refresh (SSR returns 200). But clicking the Upcoming-events tile does nothing visible: the URL updates to `/g/chicago/e/tbd-comedy-open-mic`, then the group's Today page keeps rendering. Reproduced this in a signed-in Playwright session.

## Root cause

`src/routes/g.$slug.tsx` is registered as `/g/$slug` and renders the whole group page directly (no `<Outlet />`). Because a sibling child route exists (`g.$slug.e.$eventSlug.tsx` → `/g/$slug/e/$eventSlug`), TanStack treats `g.$slug.tsx` as a **parent** layout. Parent routes MUST render `<Outlet />` for children to mount client-side. Since it doesn't, client-side navigation to a child URL updates the address bar but keeps rendering the parent's page body. SSR happens to look right only because a fresh request matches the child leaf directly.

## Fix

Split the dual-purpose route file into a leaf:

1. Rename `src/routes/g.$slug.tsx` → `src/routes/g.$slug.index.tsx`.
2. Update its `createFileRoute("/g/$slug")` call to `createFileRoute("/g/$slug/")` so the string matches the new file id.

No other files change. `g.$slug.e.$eventSlug.tsx` already declares the correct path and will now mount when clicked. The auto-generated `src/routeTree.gen.ts` regenerates on save.

## Verify

- Rebuild → routeTree regenerates without duplicate `/g/$slug` warnings.
- From `/g/chicago` Today tab, clicking the "TBD Comedy Open Mic" tile navigates to the event page and renders its content (no more stuck-on-parent behavior).
- Direct-refresh at `/g/chicago/e/tbd-comedy-open-mic` still works.
