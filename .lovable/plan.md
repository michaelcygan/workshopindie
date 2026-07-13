## Root cause

`src/routes/lounge.$id.tsx` — `LiveRoomPage` throws `notFound()` mid-render at line 133:

```
const { data: room, isFetched } = useQuery(...)   // hook #N
if (isFetched && room === null) throw notFound()  // conditional throw
const { data: invite } = useQuery(...)            // hook #N+1
const { data: forkedWs } = useQuery(...)          // hook #N+2
useEffect(...)  useEffect(...)  useEffect(...)  useEffect(...)  useQuery(...)   // more hooks
const acceptInvite = useServerFn(...)             // more hooks
const declineInvite = useServerFn(...)
```

React runs hooks 1..N, then either throws (bailing before hooks N+1..last) or continues. Between refetches, cache invalidations, `queryKey` changes when navigating between rooms, and the `refetchInterval: 5000` refetch cycle, `isFetched` and `room` transition through states where the throw fires on one render and not the next. React compares hook counts against the previous render and blows up with **"Rendered fewer hooks than expected."** The error boundary shows "Couldn't load this Lounge," and only a full browser reload clears it because the query cache is still in the flip-flop state.

Contributing factors in the same file:
- `useRouter()` called inside `errorComponent` — safe today but fragile; the boundary re-mounts on `reset()` without invalidating the room query, so the same broken cache state re-renders.
- `key={id}` on `<ChannelView>` correctly resets that subtree on Skip, but the parent hook order still varies.
- No cancellation/request-id in `joinLounge`/`hopToNext`, so a stale Join response can overwrite the newly selected room's state.

## Fix (scoped, minimal)

### 1. `src/routes/lounge.$id.tsx` — stabilize hook order
Move ALL hooks above any conditional return/throw. Convert the "not found" branch into a normal render return (or delegate to a child), NOT a mid-body throw:

```tsx
function LiveRoomPage() {
  // ── all hooks, unconditionally, in fixed order ──
  const { id } = Route.useParams()
  const { mode } = Route.useSearch()
  const { user, loading } = useAuth()
  const router = useRouter()
  const qc = useQueryClient()
  const rename = useServerFn(renameLounge)
  const endRoom = useServerFn(endLounge)
  const fetchRoom = useServerFn(getInstantRoom)
  const acceptInvite = useServerFn(acceptWorkshopJoinInvite)
  const declineInvite = useServerFn(declineWorkshopJoinInvite)
  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState("")
  const [savingTitle, setSavingTitle] = useState(false)
  const [collabOpen, setCollabOpen] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const roomQ = useQuery({ queryKey: ["instant-room", id], queryFn: ..., refetchInterval: 5000 })
  const inviteQ = useQuery({ ..., enabled: !!user && !!roomQ.data?.source_workshop_id })
  const forkedQ = useQuery({ ..., enabled: !!roomQ.data?.source_workshop_id })
  const liveCountQ = useQuery({ ..., enabled: !!user && !roomQ.data?.promoted_at })

  useEffect(/* auth redirect */)
  useEffect(/* bounce on ended */)
  useEffect(/* sessionStorage last-room */)
  useEffect(/* first-workshop toast */)
  useEffect(/* "N" hotkey */)

  // ── conditional rendering only, no conditional hooks ──
  if (loading) return <LoungeLoading />
  if (roomQ.isFetched && roomQ.data === null) return <LoungeNotFound />
  if (!roomQ.data) return <LoungeLoading />

  const room = roomQ.data
  return <LiveRoomView room={room} .../>  // pure JSX, no more hooks
}
```

Guidelines applied:
- No `throw notFound()` mid-body. Render an inline `LoungeNotFound` (same JSX as the route's `notFoundComponent`).
- Every `useQuery` uses `enabled:` so the hook is always called; the query itself no-ops.
- No new state machine, no reducer, no rewrite — just reorder + inline conditional render.

### 2. `errorComponent` — real recovery
Replace inline `useRouter()` with a small named component. On "Try again":
1. `qc.removeQueries({ queryKey: ["instant-room", id] })` and related keys
2. `qc.cancelQueries(...)`
3. `router.invalidate()`  
4. `reset()`

Add a secondary "Return to Lounge" button linking to `/lounge`. Show a friendly message ("Lounge hit a temporary problem…") and log the raw `error.stack` via existing `captureError` (from `src/lib/error-capture.ts`) — no new dependency.

### 3. Skip / Join stale-response guard
In `src/lib/instant.functions.ts` `joinLounge`/`hopToNext` call sites (mainly `HopButton` and `ChannelView`'s `dropNew`), add a request-id / cancellation pattern:

```ts
const reqRef = useRef(0)
async function onHop() {
  const my = ++reqRef.current
  const { roomId } = await hopFn(...)
  if (my !== reqRef.current) return  // superseded
  router.navigate({ to: "/lounge/$id", params: { id: roomId } })
}
```

Debounce the Hop/Skip and Join buttons via a `busy` flag (already partially in `ChannelView` — extend to `HopButton`).

### 4. ChannelView audit pass (targeted)
`src/components/channel-view.tsx` has ~25 hooks all above returns already; verify no hook was added inside a branch by newer edits. Confirm:
- `useMediaRoom(roomId)` runs unconditionally
- The auto-join effect guards on `autoJoinedRef` and cleans up when `roomId` changes (already keyed via parent `key={id}`)
- Presence/subscription effects return cleanup that unsubscribes and cancels timers

No structural changes expected here beyond spot fixes if the audit finds something.

### 5. Diagnostics
Reuse the existing `src/lib/error-capture.ts`. On error-boundary trip, capture: route, roomId, entry surface (referrer or session flag), auth status, and last transition. No PII, no chat contents.

## Files changed (expected)

- `src/routes/lounge.$id.tsx` — hook reorder, remove mid-render throw, better error boundary, request-id on Hop
- `src/components/hop-button.tsx` — debounce + stale-response guard
- `src/components/channel-view.tsx` — spot fixes only if audit surfaces any conditional hook (none expected from initial scan)
- (No new files, no schema changes, no DB migrations)

## Out of scope
- Redesign, renaming, provider swap, pricing, moderation, RLS.
- Rewriting Lounge as a reducer/state machine (existing scattered state isn't the direct cause; the mid-render `throw` is).
- Group/matchmaker DB logic (already correct from the last pass).

## Acceptance verification

I'll run Playwright against `http://localhost:8080/lounge/<id>` scenarios: fresh load, refresh-in-room, rapid double-Join, rapid double-Skip, deleted-room id (should show inline NotFound, not error boundary), and returning from `/g/$slug`. Check console for the hooks-order error string. Report which paths passed and any remaining gaps.
