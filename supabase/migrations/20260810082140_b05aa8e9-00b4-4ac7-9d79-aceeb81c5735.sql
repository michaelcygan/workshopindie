-- Wave 11: system "medium" groups follow the canonical Field vocabulary.
-- medium_group_id() resolves by groups.taxonomy_key, which now holds canonical
-- Field ids. Fields with no system group (science_research, design, ...) simply
-- resolve to NULL: nothing auto-links and no group is auto-created.

CREATE OR REPLACE FUNCTION public.sync_event_medium_groups(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  e record;
  _canon text;
  _gid uuid;
BEGIN
  SELECT id, created_by, status::text AS status, visibility::text AS visibility, creative_category
    INTO e FROM public.group_events WHERE id = _event_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF e.creative_category IS NOT NULL
     AND e.status IN ('scheduled','live','completed')
     AND e.visibility = 'public' THEN
    -- Normalize legacy stored values (film, visual, build, games_tech) to Fields.
    _canon := public.canonical_from_storage(e.creative_category);
    IF _canon IS NOT NULL THEN
      _gid := public.medium_group_id(_canon);
    END IF;
  END IF;

  IF _gid IS NOT NULL THEN
    INSERT INTO public.event_groups (event_id, group_id)
    VALUES (_event_id, _gid)
    ON CONFLICT (event_id, group_id) DO NOTHING;
    PERFORM public.ensure_medium_membership(e.created_by, _canon, 'event');
  END IF;

  DELETE FROM public.event_groups eg
  USING public.groups g
  WHERE eg.event_id = _event_id
    AND g.id = eg.group_id
    AND g.system_type = 'medium'
    AND (_gid IS NULL OR eg.group_id <> _gid);
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_blog_medium_groups(_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p record;
  _canon text[];
  _k text;
  _gid uuid;
  _target uuid[] := '{}';
BEGIN
  SELECT id, created_by, status, category_slug, fields
    INTO p FROM public.blog_posts WHERE id = _post_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF p.status = 'published' THEN
    -- Fields are authoritative; the legacy category slug is the fallback for
    -- posts written before the Field migration.
    SELECT array_agg(DISTINCT x) INTO _canon FROM (
      SELECT public.canonical_from_storage(v) AS x
        FROM unnest(coalesce(p.fields, '{}'::text[])) AS v
      UNION
      SELECT CASE
               WHEN coalesce(array_length(p.fields, 1), 0) > 0 THEN NULL
               WHEN p.category_slug IS NULL OR p.category_slug = 'general' THEN NULL
               ELSE public.canonical_from_storage(replace(p.category_slug, '-', '_'))
             END
    ) s WHERE x IS NOT NULL;
  END IF;

  FOREACH _k IN ARRAY coalesce(_canon, '{}'::text[]) LOOP
    _gid := public.medium_group_id(_k);
    IF _gid IS NOT NULL THEN
      _target := _target || _gid;
      INSERT INTO public.blog_post_entity_tags (blog_post_id, group_id, sort_order, created_by)
      VALUES (_post_id, _gid, 999, NULL)
      ON CONFLICT (blog_post_id, group_id) WHERE group_id IS NOT NULL DO NOTHING;
      PERFORM public.ensure_medium_membership(p.created_by, _k, 'blog');
    END IF;
  END LOOP;

  DELETE FROM public.blog_post_entity_tags t
  USING public.groups g
  WHERE t.blog_post_id = _post_id
    AND g.id = t.group_id
    AND g.system_type = 'medium'
    AND t.created_by IS NULL
    AND NOT (t.group_id = ANY (_target));
END;
$function$;