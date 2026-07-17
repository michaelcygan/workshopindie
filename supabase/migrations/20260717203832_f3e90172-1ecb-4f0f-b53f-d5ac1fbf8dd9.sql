ALTER TABLE public.instant_rooms
  ADD COLUMN IF NOT EXISTS pinned_message_id uuid REFERENCES public.instant_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_room_pin(_room uuid, _message uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM instant_presence
    WHERE room_id = _room AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'must be present in room';
  END IF;

  IF _message IS NULL THEN
    UPDATE instant_rooms
      SET pinned_message_id = NULL,
          pinned_by_user_id = NULL,
          pinned_at = NULL
      WHERE id = _room
        AND pinned_by_user_id = auth.uid();
    IF NOT FOUND THEN
      RAISE EXCEPTION 'only the pinner can unpin';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM instant_messages
      WHERE id = _message AND room_id = _room
    ) THEN
      RAISE EXCEPTION 'message not in room';
    END IF;
    UPDATE instant_rooms
      SET pinned_message_id = _message,
          pinned_by_user_id = auth.uid(),
          pinned_at = now()
      WHERE id = _room;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_room_pin(uuid, uuid) TO authenticated;