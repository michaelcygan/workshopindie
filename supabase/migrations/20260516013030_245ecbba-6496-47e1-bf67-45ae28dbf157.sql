
CREATE TABLE public.instant_board_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('image','sticky','link','text')),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  x numeric NOT NULL DEFAULT 40,
  y numeric NOT NULL DEFAULT 40,
  w numeric NOT NULL DEFAULT 220,
  h numeric NOT NULL DEFAULT 160,
  z integer NOT NULL DEFAULT 1,
  rotation numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_board_items_room ON public.instant_board_items(room_id);

ALTER TABLE public.instant_board_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.instant_board_items;

CREATE TRIGGER instant_board_items_updated_at
BEFORE UPDATE ON public.instant_board_items
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.instant_board_items ENABLE ROW LEVEL SECURITY;

-- Helper: is the user "in" this room (either via presence, or a workshop member if it's a workshop room)?
CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.instant_presence p
     WHERE p.room_id = _room_id AND p.user_id = _user_id
  ) OR public.is_workshop_room_member(_room_id, _user_id);
$$;

CREATE POLICY "board items visible to room members"
ON public.instant_board_items
FOR SELECT TO authenticated
USING (public.is_room_member(room_id, auth.uid()));

CREATE POLICY "members add board items"
ON public.instant_board_items
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_room_member(room_id, auth.uid()));

CREATE POLICY "creator or room owner updates board items"
ON public.instant_board_items
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.instant_rooms r WHERE r.id = room_id AND r.creator_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.instant_rooms r JOIN public.workshops w ON w.id = r.workshop_id WHERE r.id = room_id AND w.host_user_id = auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.instant_rooms r WHERE r.id = room_id AND r.creator_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.instant_rooms r JOIN public.workshops w ON w.id = r.workshop_id WHERE r.id = room_id AND w.host_user_id = auth.uid())
);

CREATE POLICY "creator or room owner deletes board items"
ON public.instant_board_items
FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.instant_rooms r WHERE r.id = room_id AND r.creator_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.instant_rooms r JOIN public.workshops w ON w.id = r.workshop_id WHERE r.id = room_id AND w.host_user_id = auth.uid())
);

CREATE POLICY "admins manage board items"
ON public.instant_board_items
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Extend room-empty cleanup to also purge board items
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

  DELETE FROM public.instant_whiteboard_assets WHERE room_id = OLD.room_id;
  DELETE FROM public.instant_board_items WHERE room_id = OLD.room_id;

  IF room_kind = 'lounge' THEN
    UPDATE public.instant_rooms
       SET status = 'archived'
     WHERE id = OLD.room_id AND status = 'active';
  END IF;

  RETURN NULL;
END;
$$;
