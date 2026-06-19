# Welcome pin "+" + "Become the Host" nudge + visible Host-claim flow

Three connected fixes for leaderless Workshops. The whole point: make it obvious that anyone can host, anyone can pin a welcome, and a soft nudge prompts someone to step up if the room idles.

---

## Part 1 — Welcome pin "+" (open by default)

### Problem
The "+ Set the room's first thought" pill never shows in unhosted Workshops. `canEdit` in `src/components/room-note-banner.tsx` requires `workshopHostId === user.id` whenever the room is workshop-paired — so leaderless = nobody can edit.

### Fix
**Permission flip** in `src/components/room-note-banner.tsx`:
- `workshopHostId` set → only that host edits.
- `workshopHostId` null → any present attendee edits (matches lounge rule).

**Pin-flavored UX:**
- Pill: `📌 + Pin a welcome for new arrivals · CC BY-SA`.
- Editor label "First thought" → "Welcome pin". Placeholder → "What should new arrivals see when they drop in?"

**Ambient nudge tooltip** at 3500ms after mount, when `canEdit && !note`, dismissed via `localStorage` `room-note-nudge:{roomId}`:
> "Pin a welcome message so new arrivals know what this room is about."
Auto-dismiss on pill click, Escape, or 12s.

### Files
- `src/components/room-note-banner.tsx`

---

## Part 2 — Surface the Host-claim flow in Workshops

### Problem
`ClaimHostPill` is mounted in `src/routes/workshop.$id.tsx` but immediately short-circuits to a passive `No Host` badge because of:
```ts
unclaimable={!!room?.workshop_id || room?.kind !== "lounge" || ...}
```
Workshop-paired rooms always show "No Host" with no affordance — no claim button anywhere. Even the empty state has no path to host.

### Fix

**1. Unlock claim in workshop rooms.** In `src/routes/workshop.$id.tsx` change the `unclaimable` prop to only block on status, not on `workshop_id` or `kind`:
```ts
unclaimable={room?.status !== "active"}
```
The server-side guards (`startHostClaim`, dwell, cooldown, object/finalize) already work room-agnostic — no server change needed.

**2. Promote the claim affordance from chip to action.** Today it lives as a tiny pill in the meta row that reads "No Host · Claim". Two changes:
- **In the meta row**, when leaderless: keep the pill but make the verb dominant — `👑 Claim Host` (primary tone instead of muted), so it reads as an offer, not status.
- **In the empty chat state** (`src/components/channel-view.tsx`), when room is leaderless and viewer dwell ≥ 60s, add a fourth starter chip alongside `Say hi 👋 / Drop a link / What's everyone working on?`:
  ```
  ✨  Claim Host & set a direction
  ```
  Click → fires the same `startHostClaim` server fn the pill uses (via `useServerFn`). Hidden once anyone is mid-claim, once dwell isn't met, or in hosted rooms.

**3. Empty-room hero hint.** When `liveCount <= 1` and leaderless, append a one-liner to the empty state:
> "No one's hosting yet — anyone here for 60s can claim it."
Disappears the moment a 2nd person joins, a claim starts, or a host is set.

### Files
- `src/routes/workshop.$id.tsx` (unclaimable prop + meta-row tone)
- `src/components/claim-host-pill.tsx` (variant tone for the active claim CTA — `primary` border/text when ready)
- `src/components/channel-view.tsx` (leaderless starter chip + hero hint)

---

## Part 3 — "Become the Host" whisper to a random non-last-actor

### Trigger
All must hold:
- Room is leaderless (no `host_user_id`, no in-flight `claim_user_id`).
- ≥ 2 present attendees (`instant_presence`, 60s cutoff).
- Viewer is not the **last actor** (most recent of: last `workshop_messages` author, or freshest joiner in last 5 min).
- Viewer hasn't dismissed it this session (`sessionStorage` `host-nudge:{roomId}`).
- Viewer's own dwell ≥ 60s (matches `DWELL_REQUIRED_MS` so the click can actually claim).

### Random pick (no server coordinator)
Each eligible viewer computes a deterministic delay between **10s and 250s** using `seedrandom(userId + roomId + epochBucket)` where `epochBucket = Math.floor(Date.now() / 600_000)`. Same seed → consistent picks within a 10-min window. Timer cancels if any condition flips.

### The prompt
A small floating card, bottom-right of the workshop column, `surface-2/70`:

```
✨  Have an idea?
    Become the Host to start working on it.
    [ Become the Host ]   [ Not now ]
```

- **Become the Host** → calls `startHostClaim` (same server fn as the pill), then closes. The existing 10s object/finalize flow takes over.
- **Not now** → `sessionStorage` dismiss for the room.
- Auto-dismiss after 20s untouched.

### Component
New `src/components/become-host-nudge.tsx`. Mounted in `src/routes/workshop.$id.tsx` alongside the header, fed by:
- Existing `room` query.
- New `presentAttendees` query (`instant_presence` 60s cutoff, 30s refresh).
- New `lastActor` query (last message author + newest joiner, 15s refresh).

### Does NOT
- Auto-promote anyone.
- Fire to the last actor, the claimant, or in hosted/ended/solo rooms.
- Persist dismissal across tabs.

### Files
- `src/components/become-host-nudge.tsx` (new)
- `src/routes/workshop.$id.tsx` (mount + 2 new queries)

---

## Out of scope
- Server-side "one nudge per room" enforcement.
- Per-message pinning.
- Push/notification system.
- Changes to claim mechanics (dwell, 10s object window, cooldown) — reuse as-is.

## No DB changes
All three parts read existing tables: `instant_rooms`, `instant_presence`, `workshop_messages`, `instant_room_claim_cooldowns`.
