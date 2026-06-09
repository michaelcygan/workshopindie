# Fix Tools in live Workshop + unify "+ Create" menu

Two small changes to `src/routes/workshop.$id.tsx` (the `/workshop/$id` instant live room — what the user is on in the screenshot).

## 1. Tools tab renders "No tools available in this room."

### Why it happens
`toolsSlot` is gated on the `room` query:
```tsx
toolsSlot={(media) => room ? <WorkshopToolsPanel ... /> : null}
```
When `room` is `null`/loading, `toolsSlot` returns `null`, so `ChannelView` falls back to its "No tools available in this room." copy. For this room (`Artist's Lounge`, `host_user_id: null`, `kind: lounge`) the panel itself fully supports a leaderless instant scope (`canEnable` is `true` for any presence when `hostUserId === null`) — the panel just never gets a chance to mount until `room` resolves, and on a brief flash / cache miss the fallback is what the user sees.

### Fix
- Drop the `room ?` guard inside `toolsSlot`. Always render `<WorkshopToolsPanel scope={{ kind: "instant", roomId: id, hostUserId: room?.host_user_id ?? null, category: (room?.category as any) ?? (room?.medium as any) ?? null }} media={media} />`. The panel already handles `hostUserId: null` and an unknown category (defaults to `coworking`).
- Result: the picker grid ("Spin up a shared tool — Docs, Pinboard, List, …") shows immediately, and the channel-view fallback string becomes effectively unreachable for signed-in users.

## 2. "Create a Collab" → "+ Create" menu

Right-rail CTA currently only opens the Collab sheet. Replace it with a single "+ Create" button that opens a small dropdown with two options:

1. **Create a Collab** — same `setCollabOpen(true)` behavior.
2. **Start a Draft Workshop** — `router.navigate({ to: "/workshops/lobby/new" })` (existing route; renamed surface = Draft Workshop). Prefills nothing — the draft form already handles category/title.

### UI shape
- Use the existing shadcn `DropdownMenu` (already in `components/ui`).
- Trigger: `<Button size="sm" className="rounded-full gap-1.5"><Plus className="h-3.5 w-3.5" /> Create</Button>` (same visual weight as today's CTA).
- Keep the same `!isPromoted && user` visibility rule so promoted lounges don't show it.
- Drop the `Rocket` icon on the trigger (move it next to the "Create a Collab" menu item instead, with a `Coffee` icon next to "Start a Draft Workshop" to mirror the home entry point).

### Out of scope
- No changes to the lounges/workshops index pages or the draft-workshop form.
- No copy or behavior change to the in-tools picker itself.
- No backend / RLS changes (instant_rooms + instant_tools policies are correct).

## Files touched
- `src/routes/workshop.$id.tsx` — remove room-gate on `toolsSlot`; swap CTA for DropdownMenu with two items.
