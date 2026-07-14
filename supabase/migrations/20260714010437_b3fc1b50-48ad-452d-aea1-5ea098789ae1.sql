
-- Atomic Lounge slot claim: prevents two simultaneous joins from bypassing the 5-cap.
-- Sweeps stale presence rows in the same transaction so the count is accurate.
CREATE OR REPLACE FUNCTION public.claim_lounge_slot(
  _room_id uuid,
  _user_id uuid,
  _cap int DEFAULT 5
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  live_count int;
  already_here boolean;
BEGIN
  -- Serialize concurrent claims on this room. Advisory locks are per-transaction.
  PERFORM pg_advisory_xact_lock(hashtext('lounge-slot:' || _room_id::text));

  -- Sweep stale rows so a crashed browser doesn't hold a seat forever.
  DELETE FROM public.instant_presence
   WHERE room_id = _room_id
     AND last_seen_at < now() - interval '60 seconds';

  SELECT EXISTS(
    SELECT 1 FROM public.instant_presence
     WHERE room_id = _room_id AND user_id = _user_id
  ) INTO already_here;

  IF already_here THEN
    UPDATE public.instant_presence
       SET last_seen_at = now(), status = 'active'
     WHERE room_id = _room_id AND user_id = _user_id;
    SELECT count(*)::int INTO live_count
      FROM public.instant_presence WHERE room_id = _room_id;
    RETURN jsonb_build_object('status', 'rejoined', 'count', live_count);
  END IF;

  SELECT count(*)::int INTO live_count
    FROM public.instant_presence WHERE room_id = _room_id;

  IF live_count >= _cap THEN
    RETURN jsonb_build_object('status', 'full', 'count', live_count);
  END IF;

  INSERT INTO public.instant_presence(room_id, user_id, status, last_seen_at)
  VALUES (_room_id, _user_id, 'active', now());

  RETURN jsonb_build_object('status', 'joined', 'count', live_count + 1);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_lounge_slot(uuid, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_lounge_slot(uuid, uuid, int) TO authenticated, service_role;

-- Per-peer periodic quality snapshots. Updates the existing connection row so
-- one row per pair still tells the whole story (initial + latest averages).
ALTER TABLE public.webrtc_connection_events
  ADD COLUMN IF NOT EXISTS snapshot_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rtt_ms int,
  ADD COLUMN IF NOT EXISTS avg_outbound_kbps_video int,
  ADD COLUMN IF NOT EXISTS avg_outbound_kbps_audio int,
  ADD COLUMN IF NOT EXISTS avg_inbound_kbps_video int,
  ADD COLUMN IF NOT EXISTS avg_inbound_kbps_audio int,
  ADD COLUMN IF NOT EXISTS packet_loss_pct_out numeric(5,2),
  ADD COLUMN IF NOT EXISTS packet_loss_pct_in numeric(5,2),
  ADD COLUMN IF NOT EXISTS jitter_ms_in int,
  ADD COLUMN IF NOT EXISTS frames_dropped int,
  ADD COLUMN IF NOT EXISTS outbound_width int,
  ADD COLUMN IF NOT EXISTS outbound_height int,
  ADD COLUMN IF NOT EXISTS outbound_fps int,
  ADD COLUMN IF NOT EXISTS quality_limitation_reason text,
  ADD COLUMN IF NOT EXISTS ice_restarts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reconnect_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_state_terminal text;
