DROP POLICY IF EXISTS "read room pins" ON public.instant_room_pins;
CREATE POLICY "read room pins" ON public.instant_room_pins
  FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS "read room work pins" ON public.instant_room_work_pins;
CREATE POLICY "read room work pins" ON public.instant_room_work_pins
  FOR SELECT TO authenticated
  USING (public.is_room_member(room_id, auth.uid()));