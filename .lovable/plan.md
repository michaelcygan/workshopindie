# Fix Lounge "Rendered more hooks" crash

## Diagnosis

Console shows: `Rendered more hooks than during the previous render.` thrown from `RoomNoteBanner` (`src/components/room-note-banner.tsx`). The Lounge-level error boundary then swallows it into the "Lounge hit a snag" screen.

Cause is a classic React hooks-order violation. The component has early returns:

- Line 90: `if (!room || room.status !== "active") return null;`
- Line 106: `if (!note && !canEdit) return null;`

…and then AFTER those returns it declares more hooks:

- Line 125: `const [showNudge, setShowNudge] = useState(false);`
- Line 126: `useEffect(() => { ... }, [canEdit, note, editing, nudgeKey]);`

First render (before the room query resolves) hits the `!room` early return and registers only the hooks above it. Once the query resolves, the component runs past the early return and React sees additional hooks appear → crash → whole Lounge unmounts into the error boundary. This is why the failure fires right after "join lounge" (the query flips from loading to loaded).

## Fix (single file: `src/components/room-note-banner.tsx`)

Move the `showNudge` state, the nudge `useEffect`, and the derived `nudgeKey` constant to the top of the component alongside the other hooks — before any early return. Everything else (`dismissNudge`, `startEdit`, `commit`, the JSX) stays exactly where it is.

Concretely, right after the existing `useEffect` at line 83:

```ts
const nudgeKey = `room-note-nudge:${roomId}`;
const [showNudge, setShowNudge] = useState(false);

useEffect(() => {
  if (!canEdit || note || editing) return;
  ...
}, [canEdit, note, editing, nudgeKey]);
```

To reference `canEdit` and `note` inside that effect (they're computed after the early returns today), compute them from `room` with safe fallbacks at the top too (both are cheap and pure):

```ts
const note = (room?.note ?? "").trim();
const workshopHasHost = !!workshopHostId;
const roomHasHost = !!room?.host_user_id;
const canEdit = !!user && !!room && (
  roomHasHost
    ? room.host_user_id === user.id
    : room.workshop_id
      ? (workshopHasHost ? workshopHostId === user.id : present)
      : room.kind === "lounge" && present
);
```

Then delete the duplicate `const note = ...` / `const canEdit = ...` block that currently lives after the early returns, and delete the now-duplicate `nudgeKey` / `useState` / `useEffect` that live further down. The two early returns (`!room || status !== "active"` and empty+read-only) stay in place; every hook is now called unconditionally on every render, satisfying the Rules of Hooks.

No other files change. No behavior change beyond the crash going away.
