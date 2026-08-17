# Fix: "Edit Work" opens the Work page instead of the editor

## What's actually broken

Reproduced in a browser: loading `/works/<slug>/edit` directly renders the **Work detail page**, not the editor. So clicking "Edit Work" appears to do nothing — the URL changes but the same page stays on screen.

Cause: `src/routes/works.$slug.tsx` and `src/routes/works.$slug.edit.tsx` both exist, which makes the Work page a *parent layout* of the edit route (confirmed in the generated route tree: the edit route's parent is the Work route). A parent must render `<Outlet />` for its child to mount; the Work page renders the article instead. The editor is therefore never mounted.

Same defect exists on sibling routes with the same shape:
- `/collab/$slug/edit` (parent `collab.$slug.tsx` has no `Outlet`)
- `/workshops/$slug/archive`, `/workshops/$slug/tools`, `/workshops/$slug/tools/$tool` (parent `workshops.$slug.tsx` has no `Outlet`)

## The fix

Opt these child routes out of nesting using TanStack's trailing-underscore convention, so each becomes its own top-level route at the same URL:

- `works.$slug.edit.tsx` → `works.$slug_.edit.tsx`, `createFileRoute("/works/$slug_/edit")`
- `collab.$slug.edit.tsx` → `collab.$slug_.edit.tsx`
- `workshops.$slug.archive.tsx` → `workshops.$slug_.archive.tsx`
- `workshops.$slug.tools.tsx` and `workshops.$slug.tools.$tool.tsx` → `workshops.$slug_.tools*.tsx`

URLs, links, and `<Link to="/works/$slug/edit">` call sites stay valid (the underscore is stripped from the URL); only the route ids change. `src/routeTree.gen.ts` regenerates itself.

## Work lifecycle audit (rest of the pass)

Verify end-to-end after the routing fix, and fix what's found:

1. **Create** — `/works/new`: draft insert → asset uploads → publish transition (`status: draft` → `published`), slug generation, taxonomy required fields.
2. **Edit** — `/works/<slug>/edit`: hydration from the row, ownership guard, save payload via `buildWorkWritePayload`, cache invalidation and redirect back to the Work.
3. **Edit entry points** — the "Edit Work" pill on the Work page, the Now-board suggestion link, and any profile/gallery owner shortcut all land on a working editor.
4. **Failure state** — the editor currently shows an infinite spinner when the row query errors (it waits on a `hydrated` flag that never flips). Add an explicit error state with a retry and a link back to the Work.
5. **Ownership** — collaborators who are credited but are not `created_by` are bounced out of the editor today. Confirm this is intended; if not, note it rather than silently changing access rules.
6. **Visibility / end of life** — public vs unlisted saves, and what a creator can do to retire a Work (delete/unlist) from the UI.

## Verification

Direct-load and in-app click-through of `/works/<slug>/edit`, `/collab/<slug>/edit`, and the workshops tools/archive routes in a headless browser, plus a save round-trip on a Work.
