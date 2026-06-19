
ALTER TABLE public.instant_rooms
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS note_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS note_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_room_note(_room_id uuid, _text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _viewer uuid := auth.uid();
  _room public.instant_rooms;
  _workshop_host uuid;
  _clean text;
  _present boolean;
  _allowed boolean := false;
BEGIN
  IF _viewer IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;

  SELECT * INTO _room FROM public.instant_rooms WHERE id = _room_id;
  IF _room IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF _room.status <> 'active' THEN RAISE EXCEPTION 'Room is not active'; END IF;

  IF _room.workshop_id IS NOT NULL THEN
    SELECT host_user_id INTO _workshop_host FROM public.workshops WHERE id = _room.workshop_id;
    IF _workshop_host = _viewer THEN _allowed := true; END IF;
  ELSIF _room.host_user_id IS NOT NULL THEN
    IF _room.host_user_id = _viewer THEN _allowed := true; END IF;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM public.instant_presence
       WHERE room_id = _room_id AND user_id = _viewer
         AND last_seen_at > now() - interval '60 seconds'
    ) INTO _present;
    IF _present THEN _allowed := true; END IF;
  END IF;

  IF NOT _allowed THEN RAISE EXCEPTION 'Not allowed to edit this room''s note'; END IF;

  _clean := nullif(btrim(coalesce(_text, '')), '');
  IF _clean IS NOT NULL AND length(_clean) > 280 THEN
    _clean := left(_clean, 280);
  END IF;

  UPDATE public.instant_rooms
     SET note = _clean,
         note_updated_at = now(),
         note_updated_by = _viewer
   WHERE id = _room_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_room_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_room_note(uuid, text) TO authenticated;
