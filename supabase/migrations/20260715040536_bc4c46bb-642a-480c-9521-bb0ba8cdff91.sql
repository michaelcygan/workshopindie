
CREATE TABLE public.event_groups (
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, group_id)
);

CREATE INDEX event_groups_group_id_idx ON public.event_groups(group_id);
CREATE INDEX event_groups_event_id_idx ON public.event_groups(event_id);

GRANT SELECT ON public.event_groups TO anon, authenticated;
GRANT INSERT, DELETE ON public.event_groups TO authenticated;
GRANT ALL ON public.event_groups TO service_role;

ALTER TABLE public.event_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view event_groups"
  ON public.event_groups FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert event_groups"
  ON public.event_groups FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete event_groups"
  ON public.event_groups FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Backfill: every existing event is tagged to its primary group
INSERT INTO public.event_groups (event_id, group_id)
SELECT id, group_id FROM public.group_events
WHERE group_id IS NOT NULL
ON CONFLICT DO NOTHING;
