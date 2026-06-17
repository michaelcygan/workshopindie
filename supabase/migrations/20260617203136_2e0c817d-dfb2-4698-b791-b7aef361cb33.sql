-- Grants for event tables (missing on initial migration)
GRANT SELECT ON public.group_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_events TO authenticated;
GRANT ALL ON public.group_events TO service_role;

GRANT SELECT ON public.group_event_rsvps TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_event_rsvps TO authenticated;
GRANT ALL ON public.group_event_rsvps TO service_role;

GRANT SELECT ON public.group_event_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_event_comments TO authenticated;
GRANT ALL ON public.group_event_comments TO service_role;

GRANT SELECT ON public.group_event_updates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_event_updates TO authenticated;
GRANT ALL ON public.group_event_updates TO service_role;

GRANT SELECT ON public.group_event_cohosts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_event_cohosts TO authenticated;
GRANT ALL ON public.group_event_cohosts TO service_role;

-- Fix broken event_comments INSERT policy: r.event_id = r.event_id (always true)
DROP POLICY IF EXISTS "event_comments insert by rsvp or host" ON public.group_event_comments;
CREATE POLICY "event_comments insert by rsvp or host"
  ON public.group_event_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_event_host(event_id, auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.group_event_rsvps r
        WHERE r.event_id = group_event_comments.event_id
          AND r.user_id = auth.uid()
          AND r.status IN ('going','maybe')
      )
    )
  );