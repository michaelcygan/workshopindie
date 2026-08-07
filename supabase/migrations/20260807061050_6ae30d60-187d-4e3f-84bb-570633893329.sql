DROP POLICY IF EXISTS "owner invites or member self-joins" ON public.recorder_persona_members;

CREATE POLICY "owner invites or scoped member self-joins"
ON public.recorder_persona_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recorder_personas p
    WHERE p.id = recorder_persona_members.persona_id
      AND p.owner_user_id = auth.uid()
  )
  OR (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.recorder_personas p
      WHERE p.id = recorder_persona_members.persona_id
        AND (
          (p.room_id IS NOT NULL AND public.is_room_member(p.room_id, auth.uid()))
          OR (p.workshop_id IS NOT NULL AND public.is_workshop_member(p.workshop_id, auth.uid()))
        )
    )
  )
);