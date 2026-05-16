ALTER TABLE public.instant_rooms DROP CONSTRAINT IF EXISTS instant_rooms_kind_check;
ALTER TABLE public.instant_rooms ADD CONSTRAINT instant_rooms_kind_check
  CHECK (kind = ANY (ARRAY['lounge'::text, 'work'::text, 'workshop'::text]));

ALTER TABLE public.instant_rooms
  ADD COLUMN IF NOT EXISTS workshop_id uuid REFERENCES public.workshops(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS instant_rooms_workshop_id_uniq
  ON public.instant_rooms(workshop_id) WHERE workshop_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_workshop_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.instant_rooms r
      JOIN public.workshops w ON w.id = r.workshop_id
     WHERE r.id = _room_id
       AND r.kind = 'workshop'
       AND (
         w.host_user_id = _user_id
         OR EXISTS (
           SELECT 1 FROM public.workshop_participants p
            WHERE p.workshop_id = w.id
              AND p.user_id = _user_id
              AND p.participant_status IN ('confirmed','checked_in','completed')
         )
       )
  );
$$;

DROP POLICY IF EXISTS "workshop members read messages" ON public.instant_messages;
CREATE POLICY "workshop members read messages" ON public.instant_messages
  FOR SELECT TO authenticated
  USING (public.is_workshop_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "workshop members write messages" ON public.instant_messages;
CREATE POLICY "workshop members write messages" ON public.instant_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_workshop_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "workshop members read presence" ON public.instant_presence;
CREATE POLICY "workshop members read presence" ON public.instant_presence
  FOR SELECT TO authenticated
  USING (public.is_workshop_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "workshop members upsert presence" ON public.instant_presence;
CREATE POLICY "workshop members upsert presence" ON public.instant_presence
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_workshop_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "workshop members update own presence" ON public.instant_presence;
CREATE POLICY "workshop members update own presence" ON public.instant_presence
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_workshop_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "workshop members read room" ON public.instant_rooms;
CREATE POLICY "workshop members read room" ON public.instant_rooms
  FOR SELECT TO authenticated
  USING (
    kind = 'workshop' AND (
      EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.host_user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.workshop_participants p
         WHERE p.workshop_id = instant_rooms.workshop_id
           AND p.user_id = auth.uid()
           AND p.participant_status IN ('confirmed','checked_in','completed')
      )
    )
  );