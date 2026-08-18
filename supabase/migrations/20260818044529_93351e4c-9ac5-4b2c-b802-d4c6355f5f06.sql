CREATE TABLE public.resource_topics (
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (resource_id, topic_id)
);

CREATE INDEX resource_topics_topic_id_idx ON public.resource_topics(topic_id);

GRANT SELECT ON public.resource_topics TO anon;
GRANT SELECT ON public.resource_topics TO authenticated;
GRANT ALL ON public.resource_topics TO service_role;

ALTER TABLE public.resource_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Resource topics are viewable by everyone"
ON public.resource_topics FOR SELECT
USING (true);

CREATE POLICY "Admins manage resource topics"
ON public.resource_topics FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));