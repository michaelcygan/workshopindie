-- Events: optional creative category ------------------------------------
ALTER TABLE public.group_events
  ADD COLUMN IF NOT EXISTS creative_category text;

ALTER TABLE public.group_events
  DROP CONSTRAINT IF EXISTS group_events_creative_category_check;
ALTER TABLE public.group_events
  ADD CONSTRAINT group_events_creative_category_check
  CHECK (creative_category IS NULL OR creative_category IN ('music','film_video','writing','visual_art','games_tech'));

-- Collabs ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_collab_medium_groups(_collab_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  _canon text[];
  _k text;
  _gid uuid;
  _target uuid[] := '{}';
BEGIN
  SELECT id, user_id, status::text AS status, category::text AS category, categories::text[] AS categories
    INTO c FROM public.collab_posts WHERE id = _collab_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF c.status IN ('open','closed') THEN
    SELECT array_agg(DISTINCT x) INTO _canon FROM (
      SELECT public.canonical_from_storage(c.category) AS x
      UNION
      SELECT public.canonical_from_storage(v) FROM unnest(coalesce(c.categories, '{}'::text[])) AS v
    ) s WHERE x IS NOT NULL;
  END IF;

  FOREACH _k IN ARRAY coalesce(_canon, '{}'::text[]) LOOP
    _gid := public.medium_group_id(_k);
    IF _gid IS NOT NULL THEN
      _target := _target || _gid;
      INSERT INTO public.group_collabs (group_id, collab_post_id, added_by)
      VALUES (_gid, _collab_id, NULL)
      ON CONFLICT (group_id, collab_post_id) DO NOTHING;
      PERFORM public.ensure_medium_membership(c.user_id, _k, 'collab');
    END IF;
  END LOOP;

  DELETE FROM public.group_collabs gc
  USING public.groups g
  WHERE gc.collab_post_id = _collab_id
    AND g.id = gc.group_id
    AND g.system_type = 'medium'
    AND gc.added_by IS NULL
    AND NOT (gc.group_id = ANY (_target));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_collab_medium_groups(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_collab_medium_groups()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_collab_medium_groups(NEW.id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_collab_medium_groups ON public.collab_posts;
CREATE TRIGGER trg_collab_medium_groups
AFTER INSERT OR UPDATE OF status, category, categories ON public.collab_posts
FOR EACH ROW EXECUTE FUNCTION public.tg_collab_medium_groups();

-- Blog -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_blog_medium_groups(_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  _canon text;
  _gid uuid;
BEGIN
  SELECT id, created_by, status, category_slug INTO p FROM public.blog_posts WHERE id = _post_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF p.status = 'published' AND p.category_slug IS NOT NULL AND p.category_slug <> 'general' THEN
    _canon := replace(p.category_slug, '-', '_');
    _gid := public.medium_group_id(_canon);
  END IF;

  IF _gid IS NOT NULL THEN
    INSERT INTO public.blog_post_entity_tags (blog_post_id, group_id, sort_order, created_by)
    VALUES (_post_id, _gid, 999, NULL)
    ON CONFLICT (blog_post_id, group_id) WHERE group_id IS NOT NULL DO NOTHING;
    PERFORM public.ensure_medium_membership(p.created_by, _canon, 'blog');
  END IF;

  DELETE FROM public.blog_post_entity_tags t
  USING public.groups g
  WHERE t.blog_post_id = _post_id
    AND g.id = t.group_id
    AND g.system_type = 'medium'
    AND t.created_by IS NULL
    AND (_gid IS NULL OR t.group_id <> _gid);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_blog_medium_groups(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_blog_medium_groups()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_blog_medium_groups(NEW.id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_blog_medium_groups ON public.blog_posts;
CREATE TRIGGER trg_blog_medium_groups
AFTER INSERT OR UPDATE OF status, category_slug ON public.blog_posts
FOR EACH ROW EXECUTE FUNCTION public.tg_blog_medium_groups();

-- Keep the automatic Blog connection when an author replaces their manual ones
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
  PERFORM public.sync_blog_medium_groups(_post_id);
END;
$$;

-- Events -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_event_medium_groups(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e record;
  _gid uuid;
BEGIN
  SELECT id, created_by, status::text AS status, visibility::text AS visibility, creative_category
    INTO e FROM public.group_events WHERE id = _event_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF e.creative_category IS NOT NULL
     AND e.status IN ('scheduled','live','completed')
     AND e.visibility = 'public' THEN
    _gid := public.medium_group_id(e.creative_category);
  END IF;

  IF _gid IS NOT NULL THEN
    INSERT INTO public.event_groups (event_id, group_id)
    VALUES (_event_id, _gid)
    ON CONFLICT (event_id, group_id) DO NOTHING;
    PERFORM public.ensure_medium_membership(e.created_by, e.creative_category, 'event');
  END IF;

  DELETE FROM public.event_groups eg
  USING public.groups g
  WHERE eg.event_id = _event_id
    AND g.id = eg.group_id
    AND g.system_type = 'medium'
    AND (_gid IS NULL OR eg.group_id <> _gid);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_event_medium_groups(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_event_medium_groups()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_event_medium_groups(NEW.id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_event_medium_groups ON public.group_events;
CREATE TRIGGER trg_event_medium_groups
AFTER INSERT OR UPDATE OF status, visibility, creative_category ON public.group_events
FOR EACH ROW EXECUTE FUNCTION public.tg_event_medium_groups();

-- Backfill ---------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.collab_posts WHERE status::text IN ('open','closed') LOOP
    PERFORM public.sync_collab_medium_groups(r.id);
  END LOOP;
  FOR r IN SELECT id FROM public.blog_posts WHERE status = 'published' LOOP
    PERFORM public.sync_blog_medium_groups(r.id);
  END LOOP;
  FOR r IN SELECT id FROM public.group_events WHERE creative_category IS NOT NULL LOOP
    PERFORM public.sync_event_medium_groups(r.id);
  END LOOP;
END $$;