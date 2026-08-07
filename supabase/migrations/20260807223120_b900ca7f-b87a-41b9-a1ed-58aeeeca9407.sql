CREATE OR REPLACE FUNCTION public.provision_locality(_provider text, _provider_id text, _name text, _state_region text, _country text, _country_code text, _lat double precision, _lng double precision, _timezone text, _location_kind text, _slug_candidates text[], _user_id uuid, _source text)
 RETURNS TABLE(city_id uuid, group_id uuid, city_slug text, group_slug text, was_created boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  PERFORM pg_advisory_xact_lock(hashtextextended(_provider || ':' || _provider_id, 0));

  SELECT * INTO v_city FROM public.cities c
   WHERE c.place_provider = _provider AND c.place_provider_id = _provider_id;

  IF NOT FOUND THEN
    FOREACH v_cand IN ARRAY coalesce(_slug_candidates, ARRAY[]::text[]) LOOP
      v_cand := public.slugify(v_cand);
      CONTINUE WHEN v_cand IS NULL OR length(v_cand) = 0;
      IF NOT EXISTS (SELECT 1 FROM public.cities c WHERE c.slug = v_cand)
         AND NOT EXISTS (SELECT 1 FROM public.groups g WHERE g.slug = v_cand) THEN
        v_slug := v_cand;
        EXIT;
      END IF;
    END LOOP;

    IF v_slug IS NULL THEN
      v_cand := coalesce(nullif(public.slugify(_name), ''), 'city');
      LOOP
        v_slug := v_cand || '-' || v_n;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.cities c WHERE c.slug = v_slug)
              AND NOT EXISTS (SELECT 1 FROM public.groups g WHERE g.slug = v_slug);
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

  SELECT * INTO v_group FROM public.groups g
   WHERE g.id = v_city.official_group_id AND g.deleted_at IS NULL;

  IF NOT FOUND THEN
    SELECT * INTO v_group FROM public.groups g
     WHERE g.city_id = v_city.id AND g.kind = 'city' AND g.is_official = true AND g.deleted_at IS NULL
     LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    v_cand := v_city.slug;
    v_n := 1;
    WHILE EXISTS (SELECT 1 FROM public.groups g WHERE g.slug = v_cand) LOOP
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

  UPDATE public.cities c
     SET official_group_id = v_group.id,
         status = CASE WHEN c.status IN ('provisioning','failed') THEN 'active' ELSE c.status END,
         needs_review = false
   WHERE c.id = v_city.id AND (c.official_group_id IS DISTINCT FROM v_group.id OR c.needs_review);

  city_id := v_city.id;
  group_id := v_group.id;
  city_slug := v_city.slug;
  group_slug := v_group.slug;
  was_created := v_created;
  RETURN NEXT;
END;
$function$;