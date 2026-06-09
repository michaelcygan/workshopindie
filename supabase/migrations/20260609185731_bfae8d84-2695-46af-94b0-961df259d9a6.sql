
-- 1) is_follow helper
CREATE OR REPLACE FUNCTION public.is_follow(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _a IS NOT NULL AND _b IS NOT NULL AND _a <> _b
    AND EXISTS (SELECT 1 FROM public.follows WHERE follower_user_id = _a AND followed_user_id = _b);
$$;

-- 2) Matchmaker (any-topic lounge): only 'open' visibility; exclude rooms with blocked party present; prefer rooms hosted by people the viewer follows.
CREATE OR REPLACE FUNCTION public.join_lounge(_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _room_id uuid;
  _stale_cutoff timestamptz := now() - interval '5 minutes';
  _live_cutoff  timestamptz := now() - interval '60 seconds';
  _cap int := 5;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user required';
  END IF;

  UPDATE public.instant_rooms r
     SET status = 'archived'
   WHERE r.kind = 'lounge'
     AND r.medium IS NULL
     AND r.status = 'active'
     AND r.created_at < _stale_cutoff
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _stale_cutoff
     );

  SELECT r.id
    INTO _room_id
    FROM public.instant_rooms r
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS live_count
        FROM public.instant_presence p
       WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
    ) lc ON true
   WHERE r.kind = 'lounge' AND r.status = 'active'
     AND r.medium IS NULL
     AND COALESCE(r.visibility, 'open') = 'open'
     AND COALESCE(lc.live_count, 0) < _cap
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id
          AND p.last_seen_at > _live_cutoff
          AND public.is_blocked_pair(_user_id, p.user_id)
     )
   ORDER BY
     (r.host_user_id IS NOT NULL AND public.is_follow(_user_id, r.host_user_id)) DESC,
     COALESCE(lc.live_count, 0) DESC,
     r.created_at ASC
   LIMIT 1;

  IF _room_id IS NULL THEN
    INSERT INTO public.instant_rooms (kind, title, slug, status, participant_cap, creator_id, medium)
    VALUES ('lounge', 'Artist''s Lounge', NULL, 'active', _cap, _user_id, NULL)
    RETURNING id INTO _room_id;
  END IF;

  RETURN _room_id;
END;
$function$;

-- 3) Matchmaker (medium-specific): same rules.
CREATE OR REPLACE FUNCTION public.join_medium_lounge(_user_id uuid, _medium category)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _room_id uuid;
  _stale_cutoff timestamptz := now() - interval '5 minutes';
  _live_cutoff  timestamptz := now() - interval '60 seconds';
  _cap int := 5;
  _title text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user required';
  END IF;
  IF _medium IS NULL THEN
    RAISE EXCEPTION 'medium required';
  END IF;

  UPDATE public.instant_rooms r
     SET status = 'archived'
   WHERE r.kind = 'lounge'
     AND r.medium = _medium
     AND r.status = 'active'
     AND r.created_at < _stale_cutoff
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _stale_cutoff
     );

  SELECT r.id
    INTO _room_id
    FROM public.instant_rooms r
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS live_count
        FROM public.instant_presence p
       WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
    ) lc ON true
   WHERE r.kind = 'lounge' AND r.status = 'active' AND r.medium = _medium
     AND COALESCE(r.visibility, 'open') = 'open'
     AND COALESCE(lc.live_count, 0) < _cap
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id
          AND p.last_seen_at > _live_cutoff
          AND public.is_blocked_pair(_user_id, p.user_id)
     )
   ORDER BY
     (r.host_user_id IS NOT NULL AND public.is_follow(_user_id, r.host_user_id)) DESC,
     COALESCE(lc.live_count, 0) DESC,
     r.created_at ASC
   LIMIT 1;

  IF _room_id IS NULL THEN
    _title := 'Instant Workshop: ' || initcap(_medium::text);
    INSERT INTO public.instant_rooms (kind, title, slug, status, participant_cap, creator_id, medium)
    VALUES ('lounge', _title, NULL, 'active', _cap, _user_id, NULL)
    RETURNING id INTO _room_id;
    -- Note: medium set above
    UPDATE public.instant_rooms SET medium = _medium WHERE id = _room_id;
  END IF;

  RETURN _room_id;
END;
$function$;
