-- 1) Table
CREATE TABLE public.blog_post_entity_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  work_id uuid REFERENCES public.works(id) ON DELETE CASCADE,
  collab_id uuid REFERENCES public.collab_posts(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  group_event_id uuid REFERENCES public.group_events(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_post_entity_tags_exactly_one_entity CHECK (
    num_nonnulls(work_id, collab_id, group_id, group_event_id, profile_id) = 1
  )
);

-- 2) Grants
GRANT SELECT ON public.blog_post_entity_tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_post_entity_tags TO authenticated;
GRANT ALL ON public.blog_post_entity_tags TO service_role;

-- 3) RLS
ALTER TABLE public.blog_post_entity_tags ENABLE ROW LEVEL SECURITY;

-- Public/anonymous readers see tags only for currently-published posts.
CREATE POLICY "blog_post_entity_tags public read published"
  ON public.blog_post_entity_tags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.blog_posts p
      WHERE p.id = blog_post_entity_tags.blog_post_id
        AND p.status = 'published'
        AND p.published_at IS NOT NULL
        AND p.published_at <= now()
    )
  );

-- Post owners can read their own draft/published tags.
CREATE POLICY "blog_post_entity_tags owner read"
  ON public.blog_post_entity_tags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.blog_posts p
      WHERE p.id = blog_post_entity_tags.blog_post_id
        AND p.created_by = auth.uid()
    )
  );

-- Admins do everything.
CREATE POLICY "blog_post_entity_tags admin all"
  ON public.blog_post_entity_tags
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Indexes
CREATE INDEX blog_post_entity_tags_post_idx ON public.blog_post_entity_tags(blog_post_id);
CREATE INDEX blog_post_entity_tags_work_idx ON public.blog_post_entity_tags(work_id) WHERE work_id IS NOT NULL;
CREATE INDEX blog_post_entity_tags_collab_idx ON public.blog_post_entity_tags(collab_id) WHERE collab_id IS NOT NULL;
CREATE INDEX blog_post_entity_tags_group_idx ON public.blog_post_entity_tags(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX blog_post_entity_tags_event_idx ON public.blog_post_entity_tags(group_event_id) WHERE group_event_id IS NOT NULL;
CREATE INDEX blog_post_entity_tags_profile_idx ON public.blog_post_entity_tags(profile_id) WHERE profile_id IS NOT NULL;

CREATE UNIQUE INDEX blog_post_entity_tags_unique_work ON public.blog_post_entity_tags(blog_post_id, work_id) WHERE work_id IS NOT NULL;
CREATE UNIQUE INDEX blog_post_entity_tags_unique_collab ON public.blog_post_entity_tags(blog_post_id, collab_id) WHERE collab_id IS NOT NULL;
CREATE UNIQUE INDEX blog_post_entity_tags_unique_group ON public.blog_post_entity_tags(blog_post_id, group_id) WHERE group_id IS NOT NULL;
CREATE UNIQUE INDEX blog_post_entity_tags_unique_event ON public.blog_post_entity_tags(blog_post_id, group_event_id) WHERE group_event_id IS NOT NULL;
CREATE UNIQUE INDEX blog_post_entity_tags_unique_profile ON public.blog_post_entity_tags(blog_post_id, profile_id) WHERE profile_id IS NOT NULL;

-- 5) Atomic replace RPC. Input tags: [{"kind":"work|collab|group|event|profile","id":"<uuid>"}, ...]
CREATE OR REPLACE FUNCTION public.replace_blog_post_entity_tags(_post_id uuid, _tags jsonb, _actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tag jsonb;
  idx integer := 0;
  k text;
  eid uuid;
BEGIN
  DELETE FROM public.blog_post_entity_tags WHERE blog_post_id = _post_id;
  FOR tag IN SELECT * FROM jsonb_array_elements(COALESCE(_tags, '[]'::jsonb)) LOOP
    k := tag ->> 'kind';
    eid := (tag ->> 'id')::uuid;
    IF k = 'work' THEN
      INSERT INTO public.blog_post_entity_tags(blog_post_id, work_id, sort_order, created_by)
      VALUES (_post_id, eid, idx, _actor);
    ELSIF k = 'collab' THEN
      INSERT INTO public.blog_post_entity_tags(blog_post_id, collab_id, sort_order, created_by)
      VALUES (_post_id, eid, idx, _actor);
    ELSIF k = 'group' THEN
      INSERT INTO public.blog_post_entity_tags(blog_post_id, group_id, sort_order, created_by)
      VALUES (_post_id, eid, idx, _actor);
    ELSIF k = 'event' THEN
      INSERT INTO public.blog_post_entity_tags(blog_post_id, group_event_id, sort_order, created_by)
      VALUES (_post_id, eid, idx, _actor);
    ELSIF k = 'profile' THEN
      INSERT INTO public.blog_post_entity_tags(blog_post_id, profile_id, sort_order, created_by)
      VALUES (_post_id, eid, idx, _actor);
    ELSE
      RAISE EXCEPTION 'Unknown entity kind: %', k;
    END IF;
    idx := idx + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_blog_post_entity_tags(uuid, jsonb, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.replace_blog_post_entity_tags(uuid, jsonb, uuid) TO service_role;