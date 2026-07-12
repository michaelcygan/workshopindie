## Goal

Make the Lounge's "New Collab" button use the real Collab creation flow (the one at `/collab/new`), and automatically pin the resulting Collab into the current Lounge's Collabs tab so the conversation and the Collab stay tied together.

Today the button opens a simplified in-lounge `CreateCollabSheet` (a parallel, cut-down form that calls `createCollabFromRoom`). That fork means the Lounge Collab misses fields, roles, timeline, location, groups, drafts, Plus gating, etc. — everything that lives in `/collab/new`. It also doesn't pin the new Collab into the Lounge, so it never shows up in the Collabs tab of the room it came from.

## Approach

Reuse `/collab/new` as-is (don't duplicate it). Open it in a new tab from the Lounge, carrying the room id, and have the real flow auto-pin the freshly-posted Collab back into that Lounge. The Lounge Collabs tab already subscribes to `instant_room_pins` in realtime, so the new Collab will appear for everyone in the room within a second — no extra plumbing needed.

Concretely:

1. **Lounge — "New Collab" button** (`src/routes/lounge.$id.tsx`)
   - Replace `onClick={() => setCollabOpen(true)}` with `window.open('/collab/new?fromLounge=<roomId>', '_blank', 'noopener,noreferrer')`.
   - Remove the `<CreateCollabSheet …/>` mount, its `collabOpen` state, the local `CreateCollabSheet` component definition, and the now-unused `createCollabFromRoom` / `LICENSE_OPTIONS` / dialog imports.
   - Update `CreateCollabNudge`'s `onCreate` to open the same URL.

2. **`/collab/new` — accept a Lounge return context** (`src/routes/collab.new.tsx`)
   - Extend `validateSearch` with `fromLounge: z.string().uuid().optional()`.
   - Read `fromLounge` from `useSearch`.
   - After the existing insert of `collab_posts` + `collab_roles` succeeds (still status `open`), if `fromLounge` is present, call the existing `pinCollab` server fn with `{ roomId: fromLounge, collabPostId: post.id }`. Best-effort: if it fails, show a toast but keep the post.
   - In the posted-confirmation dialog (`postedDialog`), when `fromLounge` is set, swap the primary CTA to "Back to the Lounge" that does `window.close()` (falls back to `navigate({ to: '/lounge/$id', params: { id: fromLounge } })` if the tab wasn't opened by us). Keep the copy-link / share options.

3. **Keep** the small ambient "New Collab" link in the header and the `CreateCollabNudge` — both just change where they point.

4. **Backend / server functions** — no changes.
   - `pinCollab` already handles both host-pin (creator = host) and guest-pin flows and is idempotent per `(room_id, collab_post_id)`.
   - The Lounge Collabs tab already fetches pins and subscribes to `instant_room_pins` realtime, so newly-pinned Collabs from `/collab/new` will show up automatically without additional wiring.
   - `createCollabFromRoom` becomes unused from the UI. Leave the server fn in place for now (not deleted) — it can be retired in a follow-up once we're sure nothing else calls it.

## What stays intact

- Real Collab flow (roles, timeline, cities, comp, rights, groups, drafts, Plus gate, share sheet).
- Live Lounge keeps running while the user posts in a separate tab.
- Collabs tab in the Lounge, its realtime, and its pin/unpin UX.
- Group Lounges: since the Collab is posted through the standard flow, the user tags Groups themselves — nothing about the Lounge auto-scopes the Collab.

## Files changed

- `src/routes/lounge.$id.tsx` — swap button + nudge target to open `/collab/new?fromLounge=…`; remove the local `CreateCollabSheet` and its imports/state.
- `src/routes/collab.new.tsx` — accept `fromLounge` search param; auto-pin on successful post; adjust success dialog CTA when opened from a Lounge.

## Follow-ups (not in this change)

- Retire `createCollabFromRoom` server fn and its migration once we confirm no other caller.
- Optional: a subtle "Posted from the {Lounge name} Lounge" chip on the Collab detail page.
