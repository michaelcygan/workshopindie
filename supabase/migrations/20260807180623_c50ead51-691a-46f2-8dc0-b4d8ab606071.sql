-- One live Workshop per Collab; one promotion per live room.
CREATE UNIQUE INDEX IF NOT EXISTS workshops_one_live_per_collab
  ON public.workshops (topic_collab_post_id)
  WHERE topic_collab_post_id IS NOT NULL
    AND status NOT IN ('archived', 'canceled');

CREATE UNIQUE INDEX IF NOT EXISTS workshops_one_per_source_room
  ON public.workshops (source_instant_room_id)
  WHERE source_instant_room_id IS NOT NULL;

-- ------------------------------------------------- Collab → live Workshop
CREATE OR REPLACE FUNCTION public.open_workshop_on_collab(_collab_post_id uuid)
RETURNS TABLE (outcome text, workshop_id uuid, workshop_slug text, room_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _post record;
  _ws record;
  _room_id uuid;
  _in_person boolean;
  _audience uuid[];
  _now timestamptz := now();
BEGIN
  IF _uid IS NULL THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::uuid, NULL::text, NULL::uuid, false;
    RETURN;
  END IF;

  SELECT id, title, user_id, category, live_workshop_id, location_mode, city_id, also_cities
    INTO _post
    FROM public.collab_posts
   WHERE id = _collab_post_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::text, NULL::uuid, false;
    RETURN;
  END IF;

  IF _post.user_id <> _uid THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::uuid, NULL::text, NULL::uuid, false;
    RETURN;
  END IF;

  -- Already linked to a live Workshop → return it (idempotent).
  IF _post.live_workshop_id IS NOT NULL THEN
    SELECT w.id, w.slug INTO _ws
      FROM public.workshops w
     WHERE w.id = _post.live_workshop_id
       AND w.status NOT IN ('archived', 'canceled');
    IF FOUND THEN
      SELECT r.id INTO _room_id
        FROM public.instant_rooms r
       WHERE r.workshop_id = _ws.id AND r.status = 'active'
       LIMIT 1;
      IF _room_id IS NULL THEN
        INSERT INTO public.instant_rooms (kind, title, status, participant_cap, creator_id, category, workshop_id)
        VALUES ('workshop', _post.title, 'active', 5, _uid, _post.category, _ws.id)
        RETURNING id INTO _room_id;
      END IF;
      RETURN QUERY SELECT 'ok'::text, _ws.id, _ws.slug, _room_id, false;
      RETURN;
    END IF;
  END IF;

  _in_person := _post.location_mode = 'in_person' AND _post.city_id IS NOT NULL;
  _audience := CASE
    WHEN _in_person THEN ARRAY(
      SELECT DISTINCT x FROM unnest(
        ARRAY[_post.city_id] || COALESCE(_post.also_cities, ARRAY[]::uuid[])
      ) AS x WHERE x IS NOT NULL
    )
    ELSE ARRAY[]::uuid[]
  END;

  INSERT INTO public.workshops (
    title, slug, category, host_user_id, mode, status, starts_at, ends_at,
    location_type, city_id, audience_city_ids, participant_cap,
    topic_collab_post_id, prompt, visibility
  ) VALUES (
    _post.title, '', _post.category, _uid, 'instant_spawned', 'active',
    _now, _now + interval '2 hours',
    CASE WHEN _in_person THEN 'in_person'::location_type ELSE 'online'::location_type END,
    CASE WHEN _in_person THEN _post.city_id ELSE NULL END,
    _audience, 5, _post.id,
    'Live working session on Collab: ' || _post.title,
    'public'
  )
  RETURNING id, slug INTO _ws;

  UPDATE public.collab_posts SET live_workshop_id = _ws.id WHERE id = _post.id;

  INSERT INTO public.workshop_participants (workshop_id, user_id, participant_status)
  VALUES (_ws.id, _uid, 'confirmed')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.instant_rooms (kind, title, status, participant_cap, creator_id, category, workshop_id)
  VALUES ('workshop', _post.title, 'active', 5, _uid, _post.category, _ws.id)
  RETURNING id INTO _room_id;

  RETURN QUERY SELECT 'ok'::text, _ws.id, _ws.slug, _room_id, true;
END;
$$;

REVOKE ALL ON FUNCTION public.open_workshop_on_collab(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_workshop_on_collab(uuid) TO authenticated, service_role;

-- ------------------------------------------------- Live room → Collab
CREATE OR REPLACE FUNCTION public.promote_room_to_collab(
  _room_id uuid,
  _title text,
  _pitch text,
  _license_label text
) RETURNS TABLE (outcome text, workshop_id uuid, workshop_slug text, collab_slug text, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _room record;
  _ws record;
  _collab record;
  _category category;
  _prompt text;
  _existing_slug text;
BEGIN
  IF _uid IS NULL THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::uuid, NULL::text, NULL::text, false;
    RETURN;
  END IF;

  SELECT id, title, kind, medium, category, host_user_id, promoted_at, source_workshop_id
    INTO _room
    FROM public.instant_rooms
   WHERE id = _room_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::text, NULL::text, false;
    RETURN;
  END IF;

  -- Already promoted → return the existing pointers.
  IF _room.promoted_at IS NOT NULL AND _room.source_workshop_id IS NOT NULL THEN
    SELECT w.id, w.slug, w.topic_collab_post_id INTO _ws
      FROM public.workshops w WHERE w.id = _room.source_workshop_id;
    IF FOUND THEN
      SELECT c.slug INTO _existing_slug
        FROM public.collab_posts c WHERE c.id = _ws.topic_collab_post_id;
      RETURN QUERY SELECT 'ok'::text, _ws.id, _ws.slug, _existing_slug, false;
      RETURN;
    END IF;
  END IF;

  IF _room.host_user_id IS DISTINCT FROM _uid THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.instant_presence
       WHERE room_id = _room_id AND user_id = _uid
    ) THEN
      RETURN QUERY SELECT 'forbidden'::text, NULL::uuid, NULL::text, NULL::text, false;
      RETURN;
    END IF;
  END IF;

  _category := COALESCE(_room.category, _room.medium, 'coworking'::category);
  _prompt := 'License: ' || COALESCE(_license_label, 'CC BY 4.0') || E'\n\n' ||
             COALESCE(NULLIF(btrim(COALESCE(_pitch, '')), ''),
                      'Forked from a live Workshop: ' || COALESCE(_room.title, _title));

  INSERT INTO public.workshops (
    title, slug, category, host_user_id, mode, status, location_type,
    participant_cap, prompt, visibility, source_instant_room_id
  ) VALUES (
    _title, '', _category, _uid, 'instant_spawned', 'active', 'online',
    12, _prompt, 'public', _room_id
  )
  RETURNING id, slug INTO _ws;

  INSERT INTO public.collab_posts (
    user_id, title, slug, category, description, live_workshop_id, location_mode, status
  ) VALUES (
    _uid, _title, '', _category,
    COALESCE(NULLIF(btrim(COALESCE(_pitch, '')), ''),
             'Forked from a live Workshop: ' || COALESCE(_room.title, _title)),
    _ws.id, 'online', 'open'
  )
  RETURNING id, slug INTO _collab;

  UPDATE public.workshops SET topic_collab_post_id = _collab.id WHERE id = _ws.id;

  UPDATE public.instant_rooms
     SET promoted_at = now(), source_workshop_id = _ws.id
   WHERE id = _room_id;

  INSERT INTO public.workshop_participants (workshop_id, user_id, participant_status)
  VALUES (_ws.id, _uid, 'confirmed')
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT 'ok'::text, _ws.id, _ws.slug, _collab.slug, true;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_room_to_collab(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_room_to_collab(uuid, text, text, text) TO authenticated, service_role;