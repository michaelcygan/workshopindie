## Changes to `src/components/channel-view.tsx`

### 1. Suppress "Workshop wrapped" for first-joiner / fresh rooms

Track when the room first became multi-party. The "alone" auto-end only triggers when:
- The user is the only one left (`media.count <= 1`), AND
- The room has been live for ≥ 5 minutes (measured from mount, OR from when a 2nd participant first appeared — see below)

Approach: store `multiPartySinceRef` — the first timestamp we observed `media.count >= 2`. If that has never happened, never auto-end (they're the first to arrive, waiting for others). If it has, only fire the end prompt once `now - multiPartySinceRef >= 5 min` AND they're alone.

Replace the existing `alone` effect:
- `const everHadCompany = multiPartySinceRef.current !== null`
- `const aloneEligible = everHadCompany && Date.now() - multiPartySinceRef.current >= 5*60*1000`
- Only schedule the 1s `setEndedOpen(true)` timer when both `alone` and `aloneEligible` are true.

This means a solo first-joiner can sit indefinitely; the wrap only fires after a real session has happened and emptied out.

### 2. Admin can dismiss the auto-end countdown

Use existing `useUserRoles()` (`src/hooks/use-user-role.tsx`) to get `isAdmin`.

In the `endedOpen` AlertDialog:
- If `isAdmin`, render an `X` close button in the header (absolute top-right, `lucide-react` `X` icon) that calls a `dismissEnded()` handler.
- `dismissEnded()` clears the countdown interval, sets `endedOpen=false`, resets `secondsLeft=30`, and sets a new ref `adminDismissedRef.current = true` so the alone-effect won't immediately re-open it for this alone-session.
- Reset `adminDismissedRef.current = false` whenever `alone` flips back to false (someone else joined).
- Gate the countdown `handleExit()` auto-forward: skip it if `isAdmin` (admins should never be force-routed home). Countdown can still tick down visually, but on reaching 0 we just close the dialog instead of navigating.

Also make the `AlertDialog`'s `onOpenChange` honor admin dismissal (currently it has no `onOpenChange`, so users can't close it at all).

### Technical details

```text
state/refs added:
  multiPartySinceRef: Ref<number | null>
  adminDismissedRef: Ref<boolean>
  { isAdmin } = useUserRoles()

effect (new): when media.count >= 2 and multiPartySinceRef.current === null
  → multiPartySinceRef.current = Date.now()

modified alone effect:
  const eligible = multiPartySinceRef.current !== null
    && Date.now() - multiPartySinceRef.current >= 5*60_000
    && !adminDismissedRef.current
  schedule end prompt only if alone && eligible

countdown effect:
  on tick to 0 → if isAdmin: close dialog only; else: handleExit()

dialog JSX:
  <AlertDialog open={endedOpen} onOpenChange={(o) => { if (!o && isAdmin) dismissEnded(); }}>
    <AlertDialogContent>
      {isAdmin && (
        <button onClick={dismissEnded} className="absolute right-3 top-3 ...">
          <X className="h-4 w-4" />
        </button>
      )}
      ...
```

No DB or server changes. No other files touched.