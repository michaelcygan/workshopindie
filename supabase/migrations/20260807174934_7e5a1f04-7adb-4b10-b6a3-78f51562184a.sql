CREATE OR REPLACE FUNCTION public.tg_instant_presence_archive_empty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining int;
  room_kind text;
BEGIN
  SELECT count(*)::int INTO remaining
    FROM public.instant_presence
    WHERE room_id = OLD.room_id;

  IF remaining > 0 THEN
    RETURN NULL;
  END IF;

  SELECT kind INTO room_kind FROM public.instant_rooms WHERE id = OLD.room_id;
  IF room_kind IS NULL THEN
    RETURN NULL;
  END IF;

  IF room_kind = 'lounge' THEN
    UPDATE public.instant_rooms
       SET emptied_at = COALESCE(emptied_at, now())
     WHERE id = OLD.room_id AND status = 'active';
  END IF;

  RETURN NULL;
END;
$$;

DROP TABLE IF EXISTS public.instant_board_items CASCADE;
DROP TABLE IF EXISTS public.instant_whiteboard_assets CASCADE;