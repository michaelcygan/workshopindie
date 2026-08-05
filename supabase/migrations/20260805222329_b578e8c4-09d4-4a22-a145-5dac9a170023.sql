-- Participation closes 24h after the event ends, and never opens for
-- drafts, archived or canceled events.
CREATE OR REPLACE FUNCTION public.is_event_wall_sealed(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.group_events e
    WHERE e.id = _event_id
      AND e.deleted_at IS NULL
      AND e.published_at IS NOT NULL
      AND e.archived_at IS NULL
      AND e.status <> 'canceled'
      AND now() < COALESCE(e.ends_at, e.starts_at + interval '4 hours') + interval '24 hours'
  );
$function$;

-- The Wall is a room, not a broadcast: participants, hosts and admins only.
DROP POLICY IF EXISTS "event_comments read if event visible" ON public.group_event_comments;
CREATE POLICY "event_comments read by participants"
ON public.group_event_comments
FOR SELECT
TO authenticated
USING (
  public.user_attended_event(auth.uid(), event_id)
  OR public.is_event_host(event_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Photos follow the same closing window as posts.
DROP POLICY IF EXISTS "Attendees upload event photos" ON public.event_photos;
CREATE POLICY "Attendees upload event photos"
ON public.event_photos
FOR INSERT
TO authenticated
WITH CHECK (
  uploader_id = auth.uid()
  AND NOT public.is_event_wall_sealed(event_id)
  AND (
    public.user_attended_event(auth.uid(), event_id)
    OR public.is_event_host(event_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Attendees view event photos" ON public.event_photos;
CREATE POLICY "Attendees view event photos"
ON public.event_photos
FOR SELECT
TO authenticated
USING (
  public.user_attended_event(auth.uid(), event_id)
  OR public.is_event_host(event_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);