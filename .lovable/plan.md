# Add the Workshop toolset to live `/workshop/$id` rooms

Right now `/workshop/$id` renders only the video tile + chat. Tools (Pinboard, Shot List, Track List, Outline, Repo & Demo, Moodboard) exist solely on persistent `/workshops/$slug`, keyed to `workshop_tools` / `workshop_tool_items`. That's why nothing shows up in your screenshot.

## What to build

### 1. Ephemeral tool tables for instant rooms

New migration creating two tables that mirror the persistent ones but are scoped to `instant_rooms.id` and swept with the room:

- `instant_tools(id, room_id, tool_type, enabled, created_at, created_by_user_id)`
  - `tool_type` ∈ pinboard | shot_list | track_list | outline | repo_links | moodboard
  - unique `(room_id, tool_type)`
- `instant_tool_items(id, tool_id, created_by_user_id, title, body, url, created_at)`

GRANTs + RLS:
- `SELECT/INSERT/UPDATE/DELETE` to `authenticated`; `ALL` to `service_role`
- Read/write gated by presence in `instant_presence` for that `room_id` (membership-scoped, matching how `instant_messages` and `instant_board_items` are protected)
- Item delete also allowed for the item author and the room's `host_user_id`
- The 24h sweep route (`/api/public/workshops.sweep`) extended to cascade-delete `instant_tools` + `instant_tool_items` for rooms with no recent presence

### 2. Polymorphic `WorkshopToolsPanel`

Rather than duplicate the component, refactor `src/components/workshop-tools-panel.tsx` to take a `scope` prop:

```ts
type Scope =
  | { kind: "persistent"; workshopId: string; hostUserId: string; category: Category }
  | { kind: "instant"; roomId: string; hostUserId: string | null };
```

Internally it picks the right tables (`workshop_tools` vs `instant_tools`, etc.) and the right query keys. For instant rooms with no host (leaderless lounge), anyone present can enable a tool; the "suggested" preset falls back to `pinboard`.

All existing call sites on `/workshops/$slug` keep working via `{ kind: "persistent", … }`.

### 3. Mount the panel in the live room

In `src/routes/workshop.$id.tsx`, render `<WorkshopToolsPanel scope={{ kind: "instant", roomId: id, hostUserId: room?.host_user_id ?? null }} />` directly under `<ChannelView />`. Hidden until the user has an `instant_presence` row (avoid empty panel for drive-bys).

### 4. Promotion carries tools forward

Update `createCollabFromRoom` in `src/lib/collab-workshop.functions.ts` so that, in the same transaction that spawns the persistent workshop, it copies `instant_tools` → `workshop_tools` and `instant_tool_items` → `workshop_tool_items` (rewriting `tool_id` references). Authorship + timestamps preserved.

After promotion the ephemeral copies remain readable until the 24h sweep, so the live room banner ("This Workshop became a Collab") still shows the same content people were looking at.

## Out of scope
- No changes to `ChannelView`, presence, or video/audio plumbing.
- No new tool types — same six presets as today.
- No changes to the persistent `/workshops/$slug` tools UX beyond the prop rename.
- Polls/whiteboard stay on their existing tables (`workshop_polls`, `instant_board_items`); not touched here.
