# Pinning Collabs in a Workshop

Add lightweight pinning for the in-room Collabs list. Anyone in the room can pin one Collab; the host can pin many and reorder them. Pins are scoped to the room and ephemeral (drop with the room).

## Rules

- **Guest (non-host):** at most one pinned Collab at a time per user. Re-pinning replaces their previous pin.
- **Host:** unlimited pins, manual order. Can unpin anyone's pin.
- **Pinned strip** renders above the existing "Collabs from people in this Workshop" list, ordered: host pins (in host's order) first, then guest pins by created_at desc.
- Pinning is only allowed if the user is currently present in the room.
- Pins clear automatically when the room ends/archives (cascade).

## Schema (one migration)

```sql
CREATE TABLE public.instant_room_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.instant_rooms(id) ON DELETE CASCADE,
  collab_post_id uuid NOT NULL REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  pinned_by_user_id uuid NOT NULL,           -- no FK to auth.users
  is_host_pin boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, collab_post_id)
);

-- Enforce "one pin per non-host user per room"
CREATE UNIQUE INDEX instant_room_pins_one_per_guest
  ON public.instant_room_pins (room_id, pinned_by_user_id)
  WHERE is_host_pin = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instant_room_pins TO authenticated;
GRANT ALL ON public.instant_room_pins TO service_role;

ALTER TABLE public.instant_room_pins ENABLE ROW LEVEL SECURITY;

-- Reads: anyone authenticated can see pins for any active room (matches Collabs panel posture)
CREATE POLICY "read pins" ON public.instant_room_pins
  FOR SELECT TO authenticated USING (true);

-- Writes go through server fns only (service_role); no direct insert/update/delete policies.

ALTER PUBLICATION supabase_realtime ADD TABLE public.instant_room_pins;
```

## Server functions (`src/lib/room-pins.functions.ts`)

All wrapped in `requireSupabaseAuth`. Use `supabaseAdmin` inside handlers after authorization.

1. `pinCollab({ roomId, collabPostId })`
   - Verify caller has a fresh `instant_presence` row in the room.
   - Lookup `instant_rooms.host_user_id`. `isHost = host_user_id === userId`.
   - If host: insert with `is_host_pin=true`, `sort_order = max(host_pins.sort_order)+1`.
   - If guest: delete any existing `is_host_pin=false` pin by user for this room, then insert with `is_host_pin=false`.
2. `unpinCollab({ pinId })`
   - Load pin → room. Allow if caller is pin owner OR host of the room.
3. `reorderHostPins({ roomId, orderedIds })`
   - Host only. Update `sort_order` on each id in the array.

No edge functions; everything is `createServerFn`.

## UI changes

`src/components/workshop-collabs-panel.tsx`:
- Accept new props: `roomId: string`, `hostUserId: string | null`.
- Add `useQuery(["room-pins", roomId])` returning joined Collab rows ordered correctly. Realtime channel `room-pins:${roomId}` on `instant_room_pins` `INSERT/UPDATE/DELETE` invalidates the query.
- New `<PinnedStrip />` above the existing list:
  - Section label `Pinned · {n}`.
  - Each card mirrors the existing collab row but compact, with a "Unpin" button visible to pin owner or host, and (host only) up/down reorder chevrons on host pins.
- Each row in the existing "Collabs from people" list gets a small Pin/Unpin toggle:
  - Guest who already has a pin: clicking another row's Pin shows confirm "Replace your pin?" then swaps.
  - Host: Pin is always additive.
- Empty pinned strip is hidden entirely.

`src/components/channel-view.tsx`:
- Pass `roomId` and `hostUserId` to `WorkshopCollabsPanel`. `hostUserId` is already fetched at the route level; thread it through `ChannelView` props (`hostUserId?: string | null`) and pass it in.

`src/routes/workshop.$id.tsx`:
- Pass `hostUserId={room?.host_user_id ?? null}` to `<ChannelView />`.

## Realtime

Single subscribed Realtime channel per room (`room-pins:${roomId}`) listening to `postgres_changes` on `instant_room_pins` filtered by `room_id=eq.${roomId}`. Subscribe in `useEffect` inside the panel; tear down on unmount.

## Files

- `supabase/migrations/<new>.sql` — table + grants + RLS + publication
- `src/lib/room-pins.functions.ts` — three server fns
- `src/components/workshop-collabs-panel.tsx` — pinned strip + pin buttons + realtime
- `src/components/channel-view.tsx` — thread `hostUserId` to the panel
- `src/routes/workshop.$id.tsx` — pass `hostUserId` to `ChannelView`

## Out of scope

- Pin notifications, pin analytics, "pin to all rooms," pin transfer when host changes (host pins simply remain; new host can unpin).
- Promoting a pinned Collab into the persistent fork (already covered by Create-a-Collab flow).
