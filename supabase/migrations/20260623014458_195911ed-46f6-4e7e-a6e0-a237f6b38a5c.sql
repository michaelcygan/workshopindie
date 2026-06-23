CREATE TABLE public.event_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  width int,
  height int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_photos_event_idx ON public.event_photos(event_id, created_at DESC);
CREATE INDEX event_photos_uploader_idx ON public.event_photos(uploader_id);

GRANT SELECT, INSERT, DELETE ON public.event_photos TO authenticated;
GRANT ALL ON public.event_photos TO service_role;

ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_attended_event(_user uuid, _event uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_event_rsvps
    WHERE event_id = _event AND user_id = _user AND status IN ('going','maybe')
  )
$$;

CREATE POLICY "Attendees view event photos"
ON public.event_photos FOR SELECT TO authenticated
USING (
  public.user_attended_event(auth.uid(), event_id)
  OR EXISTS (SELECT 1 FROM public.group_events e WHERE e.id = event_id AND e.created_by = auth.uid())
);

CREATE POLICY "Attendees upload event photos"
ON public.event_photos FOR INSERT TO authenticated
WITH CHECK (
  uploader_id = auth.uid()
  AND public.user_attended_event(auth.uid(), event_id)
);

CREATE POLICY "Uploader or host delete event photos"
ON public.event_photos FOR DELETE TO authenticated
USING (
  uploader_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.group_events e WHERE e.id = event_id AND e.created_by = auth.uid())
);

CREATE POLICY "Attendees read event-photos files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-photos'
  AND public.user_attended_event(auth.uid(), (split_part(name, '/', 1))::uuid)
);

CREATE POLICY "Attendees upload event-photos files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-photos'
  AND public.user_attended_event(auth.uid(), (split_part(name, '/', 1))::uuid)
);

CREATE POLICY "Uploader deletes own event-photos files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'event-photos'
  AND owner = auth.uid()
);