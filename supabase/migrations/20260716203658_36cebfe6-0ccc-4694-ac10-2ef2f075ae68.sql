DROP POLICY IF EXISTS lineup_signups_select_all ON public.event_lineup_signups;

CREATE POLICY lineup_signups_select_visible
  ON public.event_lineup_signups
  FOR SELECT
  TO public
  USING (
    status <> 'released'::lineup_signup_status
    AND (
      EXISTS (
        SELECT 1
          FROM public.group_events e
         WHERE e.id = event_lineup_signups.event_id
           AND e.deleted_at IS NULL
           AND (
             e.visibility = 'public'::group_event_visibility
             OR (
               e.visibility = 'group_only'::group_event_visibility
               AND auth.uid() IS NOT NULL
               AND EXISTS (
                 SELECT 1 FROM public.group_members gm
                  WHERE gm.group_id = e.group_id
                    AND gm.user_id = auth.uid()
               )
             )
             OR public.has_role(auth.uid(), 'admin'::app_role)
             OR e.created_by = auth.uid()
           )
      )
      OR user_id = auth.uid()
    )
  );

DROP TABLE IF EXISTS public.instant_whiteboard_assets CASCADE;