ALTER TABLE public.blog_post_entity_tags
  ADD COLUMN related_blog_post_id uuid REFERENCES public.blog_posts(id) ON DELETE CASCADE;

ALTER TABLE public.blog_post_entity_tags
  DROP CONSTRAINT blog_post_entity_tags_exactly_one_entity;

ALTER TABLE public.blog_post_entity_tags
  ADD CONSTRAINT blog_post_entity_tags_exactly_one_entity
  CHECK (num_nonnulls(work_id, collab_id, group_id, group_event_id, profile_id, related_blog_post_id) = 1);

ALTER TABLE public.blog_post_entity_tags
  ADD CONSTRAINT blog_post_entity_tags_no_self_reference
  CHECK (related_blog_post_id IS NULL OR related_blog_post_id <> blog_post_id);

CREATE INDEX IF NOT EXISTS blog_post_entity_tags_related_blog_post_id_idx
  ON public.blog_post_entity_tags (related_blog_post_id);

CREATE UNIQUE INDEX IF NOT EXISTS blog_post_entity_tags_related_unique_idx
  ON public.blog_post_entity_tags (blog_post_id, related_blog_post_id)
  WHERE related_blog_post_id IS NOT NULL;

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
    ELSIF k = 'post' THEN
      IF eid = _post_id THEN
        RAISE EXCEPTION 'A post cannot connect to itself.';
      END IF;
      INSERT INTO public.blog_post_entity_tags(blog_post_id, related_blog_post_id, sort_order, created_by)
      VALUES (_post_id, eid, idx, _actor);
    ELSE
      RAISE EXCEPTION 'Unknown entity kind: %', k;
    END IF;
    idx := idx + 1;
  END LOOP;
  PERFORM public.sync_blog_medium_groups(_post_id);
END;
$$;