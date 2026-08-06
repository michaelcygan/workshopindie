-- ============ Wave 3: the single provisioning primitive ============
CREATE OR REPLACE FUNCTION public.provision_locality(
  _provider text,
  _provider_id text,
  _name text,
  _state_region text,
  _country text,
  _country_code text,
  _lat double precision,
  _lng double precision,
  _timezone text,
  _location_kind text,
  _slug_candidates text[],
  _user_id uuid,
  _source text
)
RETURNS TABLE (city_id uuid, group_id uuid, city_slug text, group_slug text, was_created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city   public.cities%ROWTYPE;
  v_group  public.groups%ROWTYPE;
  v_slug   text;
  v_cand   text;
  v_n      int := 1;
  v_created boolean := false;
BEGIN
  IF _provider IS NULL OR _provider_id IS NULL OR coalesce(trim(_name),'') = '' THEN
    RAISE EXCEPTION 'provision_locality: provider identity and name are required';
  END IF;
  IF _source NOT IN ('user','admin','migration','system') THEN
    RAISE EXCEPTION 'provision_locality: invalid source';
  END IF;

  -- serialize concurrent provisioning of the same canonical place
  PERFORM pg_advisory_xact_lock(hashtextextended(_provider || ':' || _provider_id, 0));

  SELECT * INTO v_city FROM public.cities
   WHERE place_provider = _provider AND place_provider_id = _provider_id;

  IF NOT FOUND THEN
    -- pick the first free slug candidate, then fall back to numeric suffixes
    FOREACH v_cand IN ARRAY coalesce(_slug_candidates, ARRAY[]::text[]) LOOP
      v_cand := public.slugify(v_cand);
      CONTINUE WHEN v_cand IS NULL OR length(v_cand) = 0;
      IF NOT EXISTS (SELECT 1 FROM public.cities WHERE slug = v_cand)
         AND NOT EXISTS (SELECT 1 FROM public.groups WHERE slug = v_cand) THEN
        v_slug := v_cand;
        EXIT;
      END IF;
    END LOOP;

    IF v_slug IS NULL THEN
      v_cand := coalesce(nullif(public.slugify(_name), ''), 'city');
      LOOP
        v_slug := v_cand || '-' || v_n;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.cities WHERE slug = v_slug)
              AND NOT EXISTS (SELECT 1 FROM public.groups WHERE slug = v_slug);
        v_n := v_n + 1;
      END LOOP;
    END IF;

    INSERT INTO public.cities (
      name, state_region, country, country_code, slug, timezone, latitude, longitude,
      place_provider, place_provider_id, location_kind, status,
      provisioned_at, provisioned_by, provision_source
    ) VALUES (
      _name, nullif(trim(coalesce(_state_region,'')),''), coalesce(nullif(trim(coalesce(_country,'')),''), 'Unknown'),
      upper(nullif(trim(coalesce(_country_code,'')),'')), v_slug, nullif(trim(coalesce(_timezone,'')),''),
      _lat, _lng, _provider, _provider_id, nullif(trim(coalesce(_location_kind,'')),''), 'active',
      now(), _user_id, _source
    )
    RETURNING * INTO v_city;
    v_created := true;
  END IF;

  -- official city group
  SELECT * INTO v_group FROM public.groups
   WHERE id = v_city.official_group_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    SELECT * INTO v_group FROM public.groups
     WHERE city_id = v_city.id AND kind = 'city' AND is_official = true AND deleted_at IS NULL
     LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    v_cand := v_city.slug;
    v_n := 1;
    WHILE EXISTS (SELECT 1 FROM public.groups WHERE slug = v_cand) LOOP
      v_cand := v_city.slug || '-' || v_n;
      v_n := v_n + 1;
    END LOOP;

    INSERT INTO public.groups (slug, name, tagline, kind, category, city_id, join_mode, visibility, is_official, created_by)
    VALUES (
      v_cand, v_city.name, 'Creative community in ' || v_city.name || '.',
      'city', 'city', v_city.id, 'open', 'public', true, _user_id
    )
    RETURNING * INTO v_group;
  END IF;

  UPDATE public.cities
     SET official_group_id = v_group.id,
         status = CASE WHEN status IN ('provisioning','failed') THEN 'active' ELSE status END,
         needs_review = false
   WHERE id = v_city.id AND (official_group_id IS DISTINCT FROM v_group.id OR needs_review);

  city_id := v_city.id;
  group_id := v_group.id;
  city_slug := v_city.slug;
  group_slug := v_group.slug;
  was_created := v_created;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_locality(text,text,text,text,text,text,double precision,double precision,text,text,text[],uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_locality(text,text,text,text,text,text,double precision,double precision,text,text,text[],uuid,text) TO service_role;

-- ============ Retire the older overlapping auto-creation paths ============
DROP TRIGGER IF EXISTS trg_cities_mirror_into_groups ON public.cities;

CREATE OR REPLACE FUNCTION public.ensure_home_city_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  IF NEW.home_city_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only ever join the EXISTING official city group. Creating city groups is
  -- the exclusive job of public.provision_locality().
  SELECT g.id INTO v_group_id
    FROM public.cities c
    JOIN public.groups g ON g.id = c.official_group_id
   WHERE c.id = NEW.home_city_id AND g.deleted_at IS NULL;

  IF v_group_id IS NULL THEN
    SELECT id INTO v_group_id FROM public.groups
     WHERE city_id = NEW.home_city_id AND kind = 'city' AND is_official = true AND deleted_at IS NULL
     LIMIT 1;
  END IF;

  IF v_group_id IS NOT NULL THEN
    INSERT INTO public.group_members (group_id, user_id, role, source_type)
    VALUES (v_group_id, NEW.id, 'member', 'profile')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ============ Wave 8/9: search + nearest lookups ============
CREATE OR REPLACE FUNCTION public.search_cities(_q text, _limit int DEFAULT 8)
RETURNS TABLE (
  id uuid, name text, state_region text, country text, country_code text,
  slug text, official_group_id uuid, score real
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  WITH q AS (SELECT lower(extensions.unaccent(coalesce(_q,''))) AS t)
  SELECT c.id, c.name, c.state_region, c.country, c.country_code, c.slug, c.official_group_id,
         CASE
           WHEN (SELECT t FROM q) = '' THEN 0::real
           WHEN public.city_search_key(c.name, c.state_region, c.country) LIKE (SELECT t FROM q) || '%' THEN 1::real
           ELSE extensions.similarity(public.city_search_key(c.name, c.state_region, c.country), (SELECT t FROM q))
         END AS score
    FROM public.cities c
   WHERE c.status = 'active'
     AND (
       (SELECT t FROM q) = ''
       OR public.city_search_key(c.name, c.state_region, c.country) LIKE '%' || (SELECT t FROM q) || '%'
       OR extensions.similarity(public.city_search_key(c.name, c.state_region, c.country), (SELECT t FROM q)) > 0.25
     )
   ORDER BY score DESC, c.name ASC
   LIMIT LEAST(coalesce(_limit, 8), 25);
$$;

GRANT EXECUTE ON FUNCTION public.search_cities(text,int) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.nearest_active_city(
  _lat double precision, _lng double precision, _max_km double precision DEFAULT 250
)
RETURNS TABLE (
  id uuid, name text, country text, country_code text, slug text,
  latitude double precision, longitude double precision, distance_km double precision
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.id, c.name, c.country, c.country_code, c.slug, c.latitude, c.longitude,
         6371 * 2 * asin(sqrt(
           power(sin(radians(c.latitude - _lat) / 2), 2) +
           cos(radians(_lat)) * cos(radians(c.latitude)) *
           power(sin(radians(c.longitude - _lng) / 2), 2)
         )) AS distance_km
    FROM public.cities c
   WHERE c.status = 'active'
     AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
     AND c.latitude BETWEEN _lat - (_max_km / 111.0) AND _lat + (_max_km / 111.0)
     AND c.longitude BETWEEN _lng - (_max_km / (111.0 * greatest(cos(radians(_lat)), 0.05)))
                         AND _lng + (_max_km / (111.0 * greatest(cos(radians(_lat)), 0.05)))
   ORDER BY distance_km ASC
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.nearest_active_city(double precision,double precision,double precision) TO anon, authenticated, service_role;

-- ============ Wave 11: admin launch queue ============
CREATE TABLE IF NOT EXISTS public.city_launch_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_provider text NOT NULL,
  place_provider_id text NOT NULL,
  display_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  error text,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  queued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT city_launch_queue_status_check CHECK (status IN ('queued','launched','failed','cancelled')),
  CONSTRAINT city_launch_queue_identity_uniq UNIQUE (place_provider, place_provider_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.city_launch_queue TO authenticated;
GRANT ALL ON public.city_launch_queue TO service_role;
ALTER TABLE public.city_launch_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage city launch queue" ON public.city_launch_queue;
CREATE POLICY "admins manage city launch queue" ON public.city_launch_queue
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_city_launch_queue_updated_at ON public.city_launch_queue;
CREATE TRIGGER trg_city_launch_queue_updated_at
  BEFORE UPDATE ON public.city_launch_queue
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();