-- 1. New columns on instant_rooms
ALTER TABLE public.instant_rooms
  ADD COLUMN IF NOT EXISTS focus_message text,
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ended_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. instant_room_removals: per-room, time-boxed bans set by the host
CREATE TABLE IF NOT EXISTS public.instant_room_removals (
  room_id uuid NOT NULL REFERENCES public.instant_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  until timestamptz NOT NULL,
  removed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

GRANT SELECT ON public.instant_room_removals TO authenticated;
GRANT ALL ON public.instant_room_removals TO service_role;

ALTER TABLE public.instant_room_removals ENABLE ROW LEVEL SECURITY;

-- Removed person can see their own active removal (so the UI can explain why)
CREATE POLICY "read own removals"
  ON public.instant_room_removals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Host can see all removals for their room
CREATE POLICY "host reads room removals"
  ON public.instant_room_removals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instant_rooms r
       WHERE r.id = instant_room_removals.room_id
         AND r.host_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_irr_user_until ON public.instant_room_removals (user_id, until);

-- 3. Matchmaker: skip locked rooms + skip rooms where the user has an active removal
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
     AND COALESCE(r.locked, false) = false
     AND COALESCE(lc.live_count, 0) < _cap
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_room_removals rm
        WHERE rm.room_id = r.id AND rm.user_id = _user_id AND rm.until > now()
     )
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
     AND COALESCE(r.locked, false) = false
     AND COALESCE(lc.live_count, 0) < _cap
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_room_removals rm
        WHERE rm.room_id = r.id AND rm.user_id = _user_id AND rm.until > now()
     )
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
    UPDATE public.instant_rooms SET medium = _medium WHERE id = _room_id;
  END IF;

  RETURN _room_id;
END;
$function$;