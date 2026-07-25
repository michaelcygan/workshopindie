## Fix: "cannot add postgres_changes callbacks after subscribe()" in Lounge Work / Collabs tabs

### Root cause (confirmed)

Two realtime subscriptions use **stable channel names**, so when the component remounts (Strict Mode double-invoke, tab switch, or fast re-render) the Supabase client reuses an already-subscribed channel and the next `.on("postgres_changes", ...)` call throws:

- `src/components/workshop-collabs-panel.tsx` (line 111) — `channel(\`room-pins:${roomId}\`)`
- `src/components/room-gallery.tsx` (line 132) — `channel(\`room-work-pins:${roomId}\`)`

The existing `src/components/pinned-screening-strip.tsx` (line 64) already avoids this with a per-mount `instanceId` suffix — same pattern we'll apply here.

### Changes

1. **`src/components/workshop-collabs-panel.tsx`**
   - Add `const instanceId = useId()` (or `useRef(crypto.randomUUID())`).
   - Change channel name to `` `room-pins:${roomId}:${instanceId}` ``.

2. **`src/components/room-gallery.tsx`**
   - Same treatment: unique channel name per mount `` `room-work-pins:${roomId}:${instanceId}` ``.

No schema, RLS, or business-logic changes. Purely a client-side realtime lifecycle fix that matches the pattern already proven in `pinned-screening-strip.tsx`.

### Verification

- Open Lounge → Work tab and Collabs tab back-to-back on mobile; the error boundary should no longer trigger.
- Confirm pin add/remove still updates in real time.
