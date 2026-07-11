GRANT SELECT ON public.instant_rooms TO authenticated;
GRANT ALL ON public.instant_rooms TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instant_presence TO authenticated;
GRANT ALL ON public.instant_presence TO service_role;

DROP POLICY IF EXISTS "instant rooms public read" ON public.instant_rooms;
CREATE POLICY "instant rooms signed-in lounge read"
ON public.instant_rooms
FOR SELECT
TO authenticated
USING (
  collab_id IS NULL
  AND (
    group_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = instant_rooms.group_id
        AND gm.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "collab members read collab lounge" ON public.instant_rooms;
CREATE POLICY "collab members read collab lounge"
ON public.instant_rooms
FOR SELECT
TO authenticated
USING (
  collab_id IS NOT NULL
  AND public.can_access_collab_lounge(auth.uid(), collab_id)
);