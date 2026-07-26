
-- ============================================================================
-- 1. Capacity + queue fields
-- ============================================================================

ALTER TABLE public.instant_presence
  ADD COLUMN IF NOT EXISTS audio_state text NOT NULL DEFAULT 'listener',
  ADD COLUMN IF NOT EXISTS audio_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS audio_offer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS audio_joined_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'instant_presence_audio_state_chk'
  ) THEN
    ALTER TABLE public.instant_presence
      ADD CONSTRAINT instant_presence_audio_state_chk
      CHECK (audio_state IN ('listener','waiting','offered','speaker'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS instant_presence_audio_queue_idx
  ON public.instant_presence (room_id, audio_state, audio_requested_at);

-- Bump legacy 10-capacity Lounges to 20.
UPDATE public.instant_rooms
  SET participant_cap = 20
 WHERE kind = 'lounge' AND participant_cap = 10;

-- ============================================================================
-- 2. Update matchmaker + slot claim to default cap 20
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_lounge_slot(_room_id uuid, _user_id uuid, _cap integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  live_count int;
  already_here boolean;
  room_cap int;
  effective_cap int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('lounge-slot:' || _room_id::text));

  DELETE FROM public.instant_presence
   WHERE room_id = _room_id
     AND last_seen_at < now() - interval '5 minutes';

  SELECT participant_cap INTO room_cap FROM public.instant_rooms WHERE id = _room_id;
  effective_cap := COALESCE(room_cap, _cap, 20);

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
    RETURN jsonb_build_object('status', 'rejoined', 'count', live_count, 'cap', effective_cap);
  END IF;

  SELECT count(*)::int INTO live_count
    FROM public.instant_presence WHERE room_id = _room_id;

  IF live_count >= effective_cap THEN
    RETURN jsonb_build_object('status', 'full', 'count', live_count, 'cap', effective_cap);
  END IF;

  INSERT INTO public.instant_presence(room_id, user_id, status, last_seen_at)
  VALUES (_room_id, _user_id, 'active', now());

  UPDATE public.instant_rooms
     SET emptied_at = NULL
   WHERE id = _room_id;

  RETURN jsonb_build_object('status', 'joined', 'count', live_count + 1, 'cap', effective_cap);
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_lounge(_user_id uuid, _exclude_room_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _room_id uuid;
  _stale_cutoff timestamptz := now() - interval '30 seconds';
  _live_cutoff  timestamptz := now() - interval '5 minutes';
  _default_cap int := 20;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user required'; END IF;

  UPDATE public.instant_rooms r
     SET status = 'archived', closed_at = now()
   WHERE r.kind = 'lounge' AND r.medium IS NULL AND r.group_id IS NULL
     AND r.status = 'active'
     AND COALESCE(r.emptied_at, r.created_at) < _stale_cutoff
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
     );

  SELECT r.id INTO _room_id
    FROM public.instant_rooms r
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS live_count
        FROM public.instant_presence p
       WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
    ) lc ON true
   WHERE r.kind = 'lounge' AND r.status = 'active'
     AND r.medium IS NULL AND r.group_id IS NULL
     AND r.emptied_at IS NULL
     AND COALESCE(r.visibility, 'open') = 'open'
     AND COALESCE(r.locked, false) = false
     AND COALESCE(lc.live_count, 0) < COALESCE(r.participant_cap, _default_cap)
     AND NOT (r.id = ANY(COALESCE(_exclude_room_ids, '{}'::uuid[])))
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_room_removals rm
        WHERE rm.room_id = r.id AND rm.user_id = _user_id AND rm.until > now()
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
          AND public.is_blocked_pair(_user_id, p.user_id)
     )
   ORDER BY
     (r.host_user_id IS NOT NULL AND public.is_follow(_user_id, r.host_user_id)) DESC,
     COALESCE(lc.live_count, 0) DESC,
     r.created_at ASC
   LIMIT 1;

  IF _room_id IS NULL THEN
    INSERT INTO public.instant_rooms (kind, title, slug, status, participant_cap, creator_id, medium)
    VALUES ('lounge', 'Artist''s Lounge', NULL, 'active', _default_cap, _user_id, NULL)
    RETURNING id INTO _room_id;
  END IF;

  RETURN _room_id;
END;
$function$;

-- ============================================================================
-- 3. Speaker queue RPCs
--    Enforce the 10-speaker cap in SQL. Client cannot exceed it.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.promote_next_lounge_listener(_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _speakers int;
  _next_user uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('lounge-audio-queue:' || _room_id::text));

  -- Demote expired offers back to waiting so they can re-queue.
  UPDATE public.instant_presence
     SET audio_state = 'waiting'
   WHERE room_id = _room_id
     AND audio_state = 'offered'
     AND audio_offer_expires_at IS NOT NULL
     AND audio_offer_expires_at < now();

  SELECT count(*)::int INTO _speakers
    FROM public.instant_presence
   WHERE room_id = _room_id AND audio_state = 'speaker';

  IF _speakers >= 10 THEN RETURN; END IF;

  SELECT user_id INTO _next_user
    FROM public.instant_presence
   WHERE room_id = _room_id AND audio_state = 'waiting'
   ORDER BY audio_requested_at ASC NULLS LAST
   LIMIT 1;

  IF _next_user IS NULL THEN RETURN; END IF;

  UPDATE public.instant_presence
     SET audio_state = 'offered',
         audio_offer_expires_at = now() + interval '20 seconds'
   WHERE room_id = _room_id AND user_id = _next_user;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_lounge_audio_slot(_room_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _speakers int;
  _queue_pos int;
  _final_state text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('lounge-audio-queue:' || _room_id::text));

  IF NOT EXISTS (
    SELECT 1 FROM public.instant_presence
     WHERE room_id = _room_id AND user_id = _uid
  ) THEN
    RAISE EXCEPTION 'not in room';
  END IF;

  -- Demote expired offers.
  UPDATE public.instant_presence
     SET audio_state = 'waiting'
   WHERE room_id = _room_id
     AND audio_state = 'offered'
     AND audio_offer_expires_at IS NOT NULL
     AND audio_offer_expires_at < now();

  SELECT count(*)::int INTO _speakers
    FROM public.instant_presence
   WHERE room_id = _room_id AND audio_state = 'speaker';

  IF _speakers < 10 THEN
    UPDATE public.instant_presence
       SET audio_state = 'offered',
           audio_requested_at = COALESCE(audio_requested_at, now()),
           audio_offer_expires_at = now() + interval '20 seconds'
     WHERE room_id = _room_id AND user_id = _uid;
    _final_state := 'offered';
    _queue_pos := 0;
  ELSE
    UPDATE public.instant_presence
       SET audio_state = 'waiting',
           audio_requested_at = COALESCE(audio_requested_at, now()),
           audio_offer_expires_at = NULL
     WHERE room_id = _room_id AND user_id = _uid;
    SELECT count(*)::int INTO _queue_pos
      FROM public.instant_presence p1
      JOIN public.instant_presence p2
        ON p2.room_id = p1.room_id AND p2.user_id = _uid
     WHERE p1.room_id = _room_id
       AND p1.audio_state = 'waiting'
       AND p1.audio_requested_at <= p2.audio_requested_at;
    _final_state := 'waiting';
  END IF;

  RETURN jsonb_build_object(
    'state', _final_state,
    'queuePosition', _queue_pos,
    'speakerCount', _speakers
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_lounge_audio_offer(_room_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.instant_presence;
  _speakers int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('lounge-audio-queue:' || _room_id::text));

  SELECT * INTO _row FROM public.instant_presence
   WHERE room_id = _room_id AND user_id = _uid FOR UPDATE;

  IF _row IS NULL THEN RAISE EXCEPTION 'not in room'; END IF;
  IF _row.audio_state <> 'offered' THEN
    RAISE EXCEPTION 'no active offer';
  END IF;
  IF _row.audio_offer_expires_at IS NOT NULL AND _row.audio_offer_expires_at < now() THEN
    UPDATE public.instant_presence
       SET audio_state = 'waiting', audio_offer_expires_at = NULL
     WHERE room_id = _room_id AND user_id = _uid;
    RAISE EXCEPTION 'offer expired';
  END IF;

  SELECT count(*)::int INTO _speakers
    FROM public.instant_presence
   WHERE room_id = _room_id AND audio_state = 'speaker';
  IF _speakers >= 10 THEN
    UPDATE public.instant_presence
       SET audio_state = 'waiting', audio_offer_expires_at = NULL
     WHERE room_id = _room_id AND user_id = _uid;
    RAISE EXCEPTION 'speaker cap reached';
  END IF;

  UPDATE public.instant_presence
     SET audio_state = 'speaker',
         audio_joined_at = now(),
         audio_offer_expires_at = NULL
   WHERE room_id = _room_id AND user_id = _uid;

  RETURN jsonb_build_object('state', 'speaker', 'speakerCount', _speakers + 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_lounge_audio_queue(_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE public.instant_presence
     SET audio_state = 'listener',
         audio_requested_at = NULL,
         audio_offer_expires_at = NULL
   WHERE room_id = _room_id AND user_id = _uid
     AND audio_state IN ('waiting','offered');
END;
$$;

CREATE OR REPLACE FUNCTION public.release_lounge_audio_slot(_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE public.instant_presence
     SET audio_state = 'listener',
         audio_requested_at = NULL,
         audio_offer_expires_at = NULL,
         audio_joined_at = NULL
   WHERE room_id = _room_id AND user_id = _uid;

  PERFORM public.promote_next_lounge_listener(_room_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_lounge_audio_slot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_lounge_audio_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_lounge_audio_queue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_lounge_audio_slot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_next_lounge_listener(uuid) TO authenticated, service_role;

-- ============================================================================
-- 4. Security fixes
-- ============================================================================

-- group_members: self-service join must be role='member' only.
DROP POLICY IF EXISTS "Users join open groups themselves" ON public.group_members;
CREATE POLICY "Users join open groups themselves"
  ON public.group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
    AND EXISTS (
      SELECT 1 FROM public.groups g
       WHERE g.id = group_members.group_id
         AND g.deleted_at IS NULL
         AND g.join_mode = 'open'::group_join_mode
    )
  );

-- workshop_applications: applicants only create rows with status='applied'.
DROP POLICY IF EXISTS "applicant creates app" ON public.workshop_applications;
CREATE POLICY "applicant creates app"
  ON public.workshop_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'applied'
    AND NOT EXISTS (
      SELECT 1 FROM public.workshops w
       WHERE w.id = workshop_applications.workshop_id
         AND public.is_blocked_pair(auth.uid(), w.host_user_id)
    )
  );
