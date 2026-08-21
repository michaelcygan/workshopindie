CREATE TABLE public.group_event_features (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 160),
  role_label text NOT NULL CHECK (length(btrim(role_label)) BETWEEN 1 AND 80),
  about text NOT NULL CHECK (length(btrim(about)) BETWEEN 1 AND 600),
  open_house_application_id uuid REFERENCES public.open_house_applications(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX group_event_features_event_idx ON public.group_event_features (event_id, sort_order, created_at);
CREATE INDEX group_event_features_user_idx ON public.group_event_features (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX group_event_features_application_idx ON public.group_event_features (open_house_application_id) WHERE open_house_application_id IS NOT NULL;
CREATE UNIQUE INDEX group_event_features_event_application_uniq
  ON public.group_event_features (event_id, open_house_application_id)
  WHERE open_house_application_id IS NOT NULL;

GRANT SELECT ON public.group_event_features TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_event_features TO authenticated;
GRANT ALL ON public.group_event_features TO service_role;

ALTER TABLE public.group_event_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event features read if event visible"
ON public.group_event_features
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_events e
    WHERE e.id = group_event_features.event_id
      AND e.deleted_at IS NULL
      AND e.status <> 'draft'
      AND (
        e.visibility IN ('public','unlisted')
        OR (e.visibility = 'group_only' AND auth.uid() IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.group_members gm
              WHERE gm.group_id = e.group_id AND gm.user_id = auth.uid()
           ))
      )
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_event_host(event_id, auth.uid())
);

CREATE POLICY "event features managed by host or admin"
ON public.group_event_features
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_event_host(event_id, auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_event_host(event_id, auth.uid()));

CREATE TRIGGER group_event_features_touch
BEFORE UPDATE ON public.group_event_features
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();