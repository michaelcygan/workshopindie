-- Granular profile medium -> canonical creative category (only unambiguous ones)
CREATE OR REPLACE FUNCTION public.medium_to_canonical(_medium text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _medium
    WHEN 'photography' THEN 'visual_art'
    WHEN 'photography-analog' THEN 'visual_art'
    WHEN 'printmaking' THEN 'visual_art'
    WHEN 'ceramics' THEN 'visual_art'
    WHEN 'sculpture' THEN 'visual_art'
    WHEN 'painting' THEN 'visual_art'
    WHEN 'illustration' THEN 'visual_art'
    WHEN 'comics' THEN 'visual_art'
    WHEN 'dj' THEN 'music'
    WHEN 'songwriting' THEN 'music'
    WHEN 'production' THEN 'music'
    WHEN 'poetry' THEN 'writing'
    WHEN 'journalism' THEN 'writing'
    WHEN 'code' THEN 'games_tech'
    WHEN 'game-design' THEN 'games_tech'
    WHEN 'animation' THEN 'film_video'
    ELSE public.canonical_from_storage(_medium)
  END
$$;

-- Sync a Work's automatic medium-group links (added_by IS NULL marks automatic).
CREATE OR REPLACE FUNCTION public.sync_work_medium_groups(_work_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w record;
  _canon text[];
  _c text;
  _gid uuid;
  _target uuid[] := '{}';
BEGIN
  SELECT id, created_by, status::text AS status, visibility::text AS visibility,
         category::text AS category, categories::text[] AS categories
    INTO w
    FROM public.works WHERE id = _work_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF w.status = 'published' AND w.visibility = 'public' THEN
    SELECT array_agg(DISTINCT c) INTO _canon
    FROM (
      SELECT public.canonical_from_storage(w.category) AS c
      UNION
      SELECT public.canonical_from_storage(x) FROM unnest(coalesce(w.categories, '{}'::text[])) AS x
    ) s WHERE c IS NOT NULL;
  END IF;

  FOREACH _c IN ARRAY coalesce(_canon, '{}'::text[]) LOOP
    _gid := public.medium_group_id(_c);
    IF _gid IS NOT NULL THEN
      _target := _target || _gid;
      INSERT INTO public.group_works (group_id, work_id, added_by)
      VALUES (_gid, _work_id, NULL)
      ON CONFLICT (group_id, work_id) DO NOTHING;
      PERFORM public.ensure_medium_membership(w.created_by, _c, 'work');
    END IF;
  END LOOP;

  DELETE FROM public.group_works gw
  USING public.groups g
  WHERE gw.work_id = _work_id
    AND g.id = gw.group_id
    AND g.system_type = 'medium'
    AND gw.added_by IS NULL
    AND NOT (gw.group_id = ANY (_target));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_work_medium_groups(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_works_medium_groups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_work_medium_groups(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_works_medium_groups ON public.works;
CREATE TRIGGER trg_works_medium_groups
AFTER INSERT OR UPDATE OF status, visibility, category, categories ON public.works
FOR EACH ROW EXECUTE FUNCTION public.tg_works_medium_groups();

-- Profiles -> medium membership (never removes membership)
CREATE OR REPLACE FUNCTION public.sync_profile_medium_groups(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  _c text;
BEGIN
  SELECT id, categories::text[] AS categories, mediums::text[] AS mediums
    INTO p FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN RETURN; END IF;

  FOR _c IN
    SELECT DISTINCT c FROM (
      SELECT public.canonical_from_storage(x) AS c FROM unnest(coalesce(p.categories, '{}'::text[])) AS x
      UNION
      SELECT public.medium_to_canonical(y) FROM unnest(coalesce(p.mediums, '{}'::text[])) AS y
    ) s WHERE c IS NOT NULL
  LOOP
    PERFORM public.ensure_medium_membership(p.id, _c, 'profile');
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_profile_medium_groups(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_profiles_medium_groups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_profile_medium_groups(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_medium_groups ON public.profiles;
CREATE TRIGGER trg_profiles_medium_groups
AFTER INSERT OR UPDATE OF categories, mediums ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_medium_groups();

-- Idempotent backfill
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.works WHERE status::text = 'published' AND visibility::text = 'public' LOOP
    PERFORM public.sync_work_medium_groups(r.id);
  END LOOP;
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.sync_profile_medium_groups(r.id);
  END LOOP;
END $$;