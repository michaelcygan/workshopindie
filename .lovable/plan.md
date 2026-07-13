## Audit findings

Location of ICE config: `src/hooks/use-media-room.tsx` (only place `RTCPeerConnection` is constructed). Only server-side TURN touch point: `src/lib/turn.functions.ts` → `mintTurnCreds` (Cloudflare Realtime credentials API). Telemetry table: `public.turn_credential_grants` (grants only, no usage).

**Good news (no fix needed):**
- No `iceTransportPolicy: "relay"` anywhere in the codebase — production is not accidentally forcing relay.
- Default peer creation uses `STUN_ONLY` (Google STUN). TURN is minted lazily *only* on ICE `checking` timeout (8s) or `failed`/`disconnected`, per-pair, one retry max (`pairUsedTurnRef`).
- Cloudflare TURN token ID + API token are read from `process.env` inside the server-fn handler, never shipped to the client. Browser only receives short-lived `iceServers` from the mint response.
- Mint is rate-limited (10/hr/user) via `check_and_bump` RPC.
- `turn_credential_grants` inserts happen best-effort and never log the credential payload.
- Credential TTL 600s; cached in-tab with a 30s refresh buffer via `getTurnIceServers()`.

**Gaps to fix:**
1. No `getStats()` inspection after connect — we can't distinguish direct vs relay, and `turn_credential_grants` tracks *grants*, not actual relayed sessions or bytes.
2. `onicecandidateerror` is not wired, so relay auth/reachability failures are invisible.
3. Cloudflare mint response is trusted verbatim; a malformed/empty `iceServers` array currently falls through to `createPeer` with only STUN — an explicit shape check + toast-free logged error is safer.
4. No mechanism to refresh credentials mid-Lounge if a session outlives 10 min and a new peer joins after expiry (edge case: cache check works, but if mint failed once, `turnFetchPromiseRef` clears in finally — fine — but expired creds passed to a *new* peer connection would silently fail without a re-mint path). Add: on `upgradePeerToTurn`, if cached creds expire within 60s, force re-mint.
5. No staging/dev test modes (forced-TURN, direct-only) — needed to validate relay path without waiting for a natural failure.
6. No relay usage / bandwidth telemetry.

## Changes

**`src/hooks/use-media-room.tsx`**
- Add `WEBRTC_MODE` resolver reading `import.meta.env.VITE_WEBRTC_MODE` (`"auto"` | `"force-turn"` | `"direct-only"`, default `"auto"`). Gate:
  - `force-turn`: prefetch TURN before first offer; create every peer with `[...STUN_ONLY, ...turn]` and `iceTransportPolicy: "relay"`. Skip the 8s upgrade timer (already relay).
  - `direct-only`: never call `getTurnIceServers`; never arm upgrade timer. Log a warning banner in dev only.
  - `auto`: current behavior.
- Harden `getTurnIceServers()`: validate response is a non-empty array of objects containing `urls`; on invalid shape throw a controlled error caught by `upgradePeerToTurn` (already closes the pair on catch).
- In `upgradePeerToTurn`, refresh creds if `turnExpiresAtRef.current < Date.now() + 60_000` by clearing the cache before calling `getTurnIceServers()`.
- Wire `pc.onicecandidateerror` (feature-detected) to log `errorCode`/`url`/`hostCandidate` (no IP, no address field) into a per-pair diagnostic ref used by the metrics submit below.
- After each peer reaches `connected`/`completed`, call `pc.getStats()` once, find the succeeded `candidate-pair`, resolve its `localCandidate`/`remoteCandidate` types, and submit a single privacy-safe telemetry row via new server fn `recordWebrtcConnection` (see below). Fire once per pair. On `pc.close()`, if the pair was relayed, submit a follow-up `recordWebrtcRelayEnd` with duration + `bytesSent`+`bytesReceived` totals from a final `getStats()` snapshot.
- Fields recorded: `room_id`, `pair_index` (hashed peer pair, not user ids), `path` (`direct`/`relayed`), `local_candidate_type`, `remote_candidate_type`, `turn_attempted`, `turn_succeeded`, `connect_ms`, `participant_count`, `browser_family` (major from UA-Client-Hints w/ UA fallback bucketed to `chrome`/`firefox`/`safari`/`edge`/`other`), `device_class` (`mobile`/`desktop` from `navigator.userAgentData.mobile` or matchMedia coarse-pointer). No IPs, SDP, addresses, or user ids leave the client — server derives `user_id` from auth.
- Force-TURN mode still records and marks `mode: "force-turn"` so staging numbers don't pollute production dashboards.

**`src/lib/turn.functions.ts`**
- Add two new server fns in the same file:
  - `recordWebrtcConnection` — auth-guarded, Zod-validated payload above, `INSERT` into new `webrtc_connection_events`.
  - `recordWebrtcRelayEnd` — updates the row with `relay_ended_at`, `bytes_sent`, `bytes_received`.
- Keep `mintTurnCreds` unchanged except: also stamp the inserted `turn_credential_grants` row with an `env_mode` column so forced-TURN staging spikes don't look like a production regression.

**New migration `supabase/migrations/<ts>_webrtc_connection_events.sql`**
```sql
CREATE TABLE public.webrtc_connection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid,
  path text NOT NULL,                    -- 'direct' | 'relayed' | 'failed'
  local_candidate_type text,
  remote_candidate_type text,
  turn_attempted boolean NOT NULL DEFAULT false,
  turn_succeeded boolean NOT NULL DEFAULT false,
  connect_ms integer,
  participant_count integer,
  browser_family text,
  device_class text,
  env_mode text NOT NULL DEFAULT 'auto', -- 'auto' | 'force-turn' | 'direct-only'
  bytes_sent bigint,
  bytes_received bigint,
  relay_ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.webrtc_connection_events TO authenticated;
GRANT ALL   ON public.webrtc_connection_events TO service_role;
ALTER TABLE public.webrtc_connection_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read webrtc events"
  ON public.webrtc_connection_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own webrtc events"
  ON public.webrtc_connection_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own webrtc events"
  ON public.webrtc_connection_events FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX ON public.webrtc_connection_events (created_at DESC);
CREATE INDEX ON public.webrtc_connection_events (path, created_at DESC);

ALTER TABLE public.turn_credential_grants ADD COLUMN env_mode text NOT NULL DEFAULT 'auto';
```

**Env vars (documentation only, not committed):**
- `VITE_WEBRTC_MODE` = `auto` (prod default), `force-turn` (staging), `direct-only` (dev). Not exposed in UI — no user-facing toggle.

## What is NOT changing

- No SFU migration. No Lounge redesign. No changes to `ROOM_CAP`, presence, signaling, bandwidth governor, or the 5-participant limit. The direct-first negotiation path, per-pair upgrade timer (8s), and one-retry rule are preserved.

## Report format (delivered after implementation)

Where ICE is created, whether TURN was ever forced (no), credential lifetime + refresh behavior, how relay is detected (candidate-pair stats), config errors found (Cloudflare response passed through unvalidated — fixed), files changed, test paths run (auto path via natural connect, forced-TURN via env override, direct-only smoke), and risk assessment of disabling TURN (based on the new `webrtc_connection_events` `path='relayed'` rate).
