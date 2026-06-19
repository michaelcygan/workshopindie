# No Host — claim flow (revised)

## 1. Rename the label
- `src/routes/workshop.$id.tsx` line 276: `Leaderless` → `No Host`
- `rg -i "leaderless"` audit to catch any future copy.

## 2. How a room becomes "No Host"
Already implicit: `instant_rooms.host_user_id` is nullable with `ON DELETE SET NULL`, and host abdication / account deletion leaves it null. No new "abdicate" action in this pass — we just make the resulting state recoverable.

## 3. Claim model — "consent-or-lapse, single objector vetoes"

**Claimant: 1 click.** The pill flips from a static `No Host` badge into a button **`No Host · Claim`** for anyone present in the room for ≥ 60 s. Clicking opens a 10-second confirmation window:
- Claimant sees `Confirming… (8s)` and nothing else.
- Every *other present participant* sees an inline toast `Alex wants to host — Object` with the same countdown.

**Result rules:**
- **Any single Object** within the window → claim reverts, `host_user_id` stays NULL, 5-minute cooldown on a fresh claim by the same user on the same room.
- **Timer lapses with zero objections** → `host_user_id = claimant`, room now has a host. Silent participants and offline participants count as consent.

This matches your "all users must consent or lapse" rule literally: every present participant has 10 s to veto; saying nothing = consent; not being there = lapsed = consent.

**Guards (kept minimal):**
- Viewer must be present (heartbeat within 60 s) AND have ≥ 60 s of dwell time.
- 5-minute per-room cooldown after a reverted claim against the same claimant.
- Workshop-paired rooms (`kind = 'workshop'`, `workshop_id IS NOT NULL`) are **not claimable** — the Workshop has its own canonical host record; pill stays as a muted `No Host` until that host returns. (Recommendation: keep this strict; making them claimable would conflict with the Workshop's RLS owner.)

## 4. UI surfaces

`src/routes/workshop.$id.tsx` header pill becomes `<ClaimHostPill />` (new component, `src/components/claim-host-pill.tsx`) with these states:

| Viewer state | Renders |
|---|---|
| Not eligible (dwell < 60s, or cooldown) | `No Host` (muted, no action) |
| Eligible, no pending claim | `No Host · Claim` button |
| Pending claim, you are claimant | `Confirming… (8s)` muted pill |
| Pending claim, you are someone else | `Alex wants to host · Object (8s)` button |
| Workshop-paired room | `No Host` (muted, no action, no claim) |

After a successful claim the existing `Hosting` pill + `HostMenu` light up for the new host via cache invalidation of `["instant-room", id]`.

## 5. Technical details

**Migration (`supabase/migrations/<new>.sql`):**

Columns added to `instant_rooms`:
- `claim_user_id uuid references auth.users(id) on delete set null`
- `claim_started_at timestamptz`
- `claim_vetoed boolean default false` (set true the moment any Object lands; client/RPC reads this to know the claim died)
- `last_claim_reverted_at timestamptz` (used only for per-claimant cooldown on the same room — stored on a side table `instant_room_claim_cooldowns(room_id, user_id, until)` so cooldowns are per-user, not per-room)

RPCs (security definer, search_path = public):

- `start_host_claim(_room_id uuid)` →
  - Reject if `host_user_id IS NOT NULL`, if `kind <> 'lounge'`, if `workshop_id IS NOT NULL`, if room not active.
  - Reject if viewer not present ≥ 60 s, or has a row in `instant_room_claim_cooldowns` with `until > now()`.
  - Reject if there's already a pending claim within the last 10 s.
  - Set `claim_user_id = viewer`, `claim_started_at = now()`, `claim_vetoed = false`.
- `object_host_claim(_room_id uuid)` →
  - Reject if viewer is the claimant, not present, or window has lapsed (`now() - claim_started_at > '10 seconds'`).
  - Set `claim_vetoed = true`; insert cooldown row `(room_id, claim_user_id, now() + interval '5 minutes')`; clear `claim_user_id`/`claim_started_at`.
- `finalize_host_claim(_room_id uuid)` →
  - Called by the claimant's client when the timer ends.
  - If `claim_vetoed` is false AND `claim_user_id` is still set AND `now() - claim_started_at >= '10 seconds'` AND `host_user_id IS NULL`, set `host_user_id = claim_user_id`, clear claim fields.
  - Otherwise no-op (idempotent).

A small sweeper isn't required — `finalize_host_claim` is called by whoever ran the claim, and other clients see the state through the existing `["instant-room", id]` poll. If the claimant disconnects mid-window, the next call to `start_host_claim` by anyone is allowed once 10 s has passed (since the previous `claim_started_at` is stale and the room is still leaderless).

**Server functions (append to `src/lib/host-room.functions.ts`):**
`startHostClaim`, `objectHostClaim`, `finalizeHostClaim` — thin `requireSupabaseAuth` wrappers around the three RPCs.

**Component (`src/components/claim-host-pill.tsx`, new):**
- Reads `room` from the existing `["instant-room", id]` query (already polled).
- Local 1 Hz `setInterval` to drive the countdown.
- Calls `finalizeHostClaim` once when the claimant's timer hits 0.
- Invalidates `["instant-room", id]` on any state transition.

**Cooldown table migration:**
```sql
CREATE TABLE public.instant_room_claim_cooldowns (
  room_id uuid NOT NULL REFERENCES public.instant_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  until timestamptz NOT NULL,
  PRIMARY KEY (room_id, user_id)
);
GRANT SELECT ON public.instant_room_claim_cooldowns TO authenticated;
GRANT ALL ON public.instant_room_claim_cooldowns TO service_role;
ALTER TABLE public.instant_room_claim_cooldowns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self read cooldown" ON public.instant_room_claim_cooldowns
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- writes happen via SECURITY DEFINER RPCs only; no INSERT/UPDATE/DELETE policy
```

## 6. Out of scope (intentional)
- No explicit "Abdicate host" button.
- No notification fan-out.
- No analytics events yet.
