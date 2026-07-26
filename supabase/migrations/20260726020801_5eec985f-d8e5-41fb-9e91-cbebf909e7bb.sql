-- Wave 5 — Lounge audio reliability, moderation & observability

-- 1) Stale speaker sweeper: any presence row still marked as speaker but not
--    heartbeat-ed in 60s is silently returned to the listener pool so the
--    seat can be reused. Runs as SECURITY DEFINER so pg_cron / any caller
--    can execute it via the /api/public sweep route without RLS friction.
CREATE OR REPLACE FUNCTION public.sweep_stale_lounge_speakers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reclaimed integer;
BEGIN
  WITH updated AS (
    UPDATE public.instant_presence
       SET audio_state = 'listener',
           audio_requested_at = NULL,
           audio_offer_expires_at = NULL,
           audio_joined_at = NULL
     WHERE audio_state IN ('speaker', 'offered', 'waiting')
       AND last_seen_at < now() - INTERVAL '60 seconds'
    RETURNING 1
  )
  SELECT count(*) INTO reclaimed FROM updated;
  RETURN COALESCE(reclaimed, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_stale_lounge_speakers() FROM public;
GRANT EXECUTE ON FUNCTION public.sweep_stale_lounge_speakers() TO authenticated, service_role;

-- 2) Moderator action on a Lounge speaker. Room host OR platform admin only.
--    action = 'mute'   → flips speaker to 'listener' quietly (client observes
--                        the audio_state change and disables its mic track).
--    action = 'remove' → same DB effect but also emits a telemetry row so we
--                        can see moderator-driven removals in analytics.
CREATE OR REPLACE FUNCTION public.moderate_lounge_speaker(
  _room_id uuid,
  _target_user_id uuid,
  _action text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  host uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _action NOT IN ('mute', 'remove') THEN
    RAISE EXCEPTION 'invalid action %', _action;
  END IF;

  SELECT host_user_id INTO host FROM public.instant_rooms WHERE id = _room_id;
  IF host IS NULL AND NOT public.has_role(caller, 'admin') THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF host IS DISTINCT FROM caller
     AND NOT public.has_role(caller, 'admin') THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  UPDATE public.instant_presence
     SET audio_state = 'listener',
         audio_requested_at = NULL,
         audio_offer_expires_at = NULL,
         audio_joined_at = NULL
   WHERE room_id = _room_id
     AND user_id = _target_user_id
     AND audio_state IN ('speaker', 'offered', 'waiting');

  INSERT INTO public.lounge_audio_events (room_id, user_id, event, payload)
  VALUES (
    _room_id,
    _target_user_id,
    CASE WHEN _action = 'mute' THEN 'speaker_leave' ELSE 'speaker_leave' END,
    jsonb_build_object('moderated_by', caller, 'action', _action)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_lounge_speaker(uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.moderate_lounge_speaker(uuid, uuid, text) TO authenticated;

-- 3) Daily rollup view over lounge_audio_events. A plain view (not MV) so we
--    don't need to schedule refreshes; volume is small and the admin panel
--    queries it once per page load.
CREATE OR REPLACE VIEW public.lounge_audio_daily AS
SELECT
  date_trunc('day', created_at)::date AS day,
  user_id,
  count(*) FILTER (WHERE event = 'connected_minutes') AS minutes,
  count(*) FILTER (WHERE event = 'mic_request')       AS mic_grabs,
  count(*) FILTER (WHERE event = 'queue_abandon')     AS queue_abandons,
  count(*) FILTER (WHERE event = 'audio_reconnect')   AS reconnects,
  count(*) FILTER (WHERE event = 'mic_permission_denied') AS mic_denials,
  count(*) FILTER (WHERE event = 'speaker_join')      AS speaker_joins
FROM public.lounge_audio_events
GROUP BY 1, 2;

REVOKE ALL ON public.lounge_audio_daily FROM public, anon, authenticated;
GRANT SELECT ON public.lounge_audio_daily TO service_role;
