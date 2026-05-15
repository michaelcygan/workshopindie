
-- Indexes for matchmaker
CREATE INDEX IF NOT EXISTS idx_instant_rooms_kind_status_created
  ON public.instant_rooms (kind, status, created_at);
CREATE INDEX IF NOT EXISTS idx_instant_presence_room_lastseen
  ON public.instant_presence (room_id, last_seen_at);

-- Archive any existing 'work' rooms (Work concept retired)
UPDATE public.instant_rooms SET status = 'archived' WHERE kind = 'work' AND status = 'active';

-- Reduce participant cap default to 5 going forward
ALTER TABLE public.instant_rooms ALTER COLUMN participant_cap SET DEFAULT 5;

-- Matchmaker: pick the fullest active lounge with capacity, else create one.
-- Returns the chosen room id. Runs as definer to bypass RLS for inserts/archives.
CREATE OR REPLACE FUNCTION public.join_lounge(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _room_id uuid;
  _stale_cutoff timestamptz := now() - interval '5 minutes';
  _live_cutoff  timestamptz := now() - interval '60 seconds';
  _cap int := 5;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user required';
  END IF;

  -- Archive ghost lounges: active but no recent presence and older than 5 min
  UPDATE public.instant_rooms r
     SET status = 'archived'
   WHERE r.kind = 'lounge'
     AND r.status = 'active'
     AND r.created_at < _stale_cutoff
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _stale_cutoff
     );

  -- Pick fullest active lounge with capacity (live_count < cap), oldest first as tiebreaker.
  SELECT r.id
    INTO _room_id
    FROM public.instant_rooms r
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS live_count
        FROM public.instant_presence p
       WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
    ) lc ON true
   WHERE r.kind = 'lounge' AND r.status = 'active'
     AND COALESCE(lc.live_count, 0) < _cap
   ORDER BY COALESCE(lc.live_count, 0) DESC, r.created_at ASC
   LIMIT 1;

  IF _room_id IS NULL THEN
    INSERT INTO public.instant_rooms (kind, title, slug, status, participant_cap, creator_id)
    VALUES ('lounge', 'Artist''s Lounge', NULL, 'active', _cap, _user_id)
    RETURNING id INTO _room_id;
  END IF;

  RETURN _room_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_lounge(uuid) TO authenticated;
