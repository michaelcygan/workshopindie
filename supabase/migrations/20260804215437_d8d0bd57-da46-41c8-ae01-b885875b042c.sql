CREATE OR REPLACE FUNCTION public.publish_work_from_collab(
  _collab uuid,
  _title text,
  _description text,
  _cover_url text,
  _primary_url text,
  _category public.category,
  _credited_user_ids uuid[],
  _extra_credits jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _post public.collab_posts%ROWTYPE;
  _work public.works%ROWTYPE;
  _members uuid[];
  _uid2 uuid;
  _sort int := 1;
  _cred jsonb;
  _role text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;

  SELECT * INTO _post FROM public.collab_posts WHERE id = _collab FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Collab not found'; END IF;
  IF _post.user_id <> _uid THEN RAISE EXCEPTION 'Only the host can publish a Work from this Collab'; END IF;
  IF _post.archived_at IS NOT NULL OR _post.status IN ('archived','removed') THEN
    RAISE EXCEPTION 'This Collab is archived. Restore it before publishing.';
  END IF;

  -- Idempotent: a second request returns the Work that already exists.
  IF _post.resulting_work_id IS NOT NULL THEN
    SELECT * INTO _work FROM public.works WHERE id = _post.resulting_work_id;
    RETURN jsonb_build_object('ok', true, 'work_id', _work.id, 'work_slug', _work.slug, 'already', true);
  END IF;

  INSERT INTO public.works (
    title, slug, category, description, cover_url, primary_url,
    source_type, source_collab_post_id, status, visibility, license_type, created_by
  ) VALUES (
    btrim(_title), '', _category, NULLIF(btrim(COALESCE(_description, '')), ''),
    NULLIF(btrim(COALESCE(_cover_url, '')), ''), NULLIF(btrim(COALESCE(_primary_url, '')), ''),
    'collab_board', _post.id, 'published', 'public', 'cc_by', _uid
  ) RETURNING * INTO _work;

  -- Only accepted collaborators may be credited.
  SELECT COALESCE(array_agg(DISTINCT i.invitee_user_id), '{}')
    INTO _members
    FROM public.collab_invites i
   WHERE i.collab_post_id = _post.id
     AND i.status = 'accepted'
     AND i.invitee_user_id = ANY (COALESCE(_credited_user_ids, '{}'::uuid[]))
     AND i.invitee_user_id <> _uid;

  INSERT INTO public.work_credits (work_id, user_id, role_label, sort_order)
  VALUES (_work.id, _uid, 'Creator', 0);

  FOREACH _uid2 IN ARRAY _members LOOP
    SELECT r.role_name INTO _role
      FROM public.collab_contact_events e
      LEFT JOIN public.collab_roles r ON r.id = e.collab_role_id
     WHERE e.collab_post_id = _post.id AND e.sender_user_id = _uid2 AND r.role_name IS NOT NULL
     ORDER BY e.sent_at ASC LIMIT 1;

    INSERT INTO public.work_credits (work_id, user_id, role_label, sort_order)
    VALUES (_work.id, _uid2, COALESCE(_role, 'Collaborator'), _sort);

    INSERT INTO public.work_collaborators (work_id, user_id, role)
    VALUES (_work.id, _uid2, 'collaborator')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, kind, actor_user_id, entity_type, entity_id, payload)
    VALUES (_uid2, 'work_published', _uid, 'work', _work.id,
            jsonb_build_object('work_slug', _work.slug, 'title', _work.title, 'collab_id', _post.id));

    _sort := _sort + 1;
    _role := NULL;
  END LOOP;

  -- External / non-account credits.
  IF _extra_credits IS NOT NULL THEN
    FOR _cred IN SELECT * FROM jsonb_array_elements(_extra_credits) LOOP
      IF COALESCE(btrim(_cred->>'name'), '') <> '' THEN
        INSERT INTO public.work_credits (work_id, user_id, display_name, role_label, sort_order)
        VALUES (_work.id, NULL, btrim(_cred->>'name'),
                COALESCE(NULLIF(btrim(COALESCE(_cred->>'role','')), ''), 'Collaborator'), _sort);
        _sort := _sort + 1;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.collab_posts
     SET resulting_work_id = _work.id,
         applications_open = false,
         status = 'closed',          -- legacy compatibility during rollout
         closed_at = COALESCE(closed_at, now()),
         updated_at = now()
   WHERE id = _post.id;

  RETURN jsonb_build_object('ok', true, 'work_id', _work.id, 'work_slug', _work.slug, 'already', false);
END;
$$;

REVOKE ALL ON FUNCTION public.publish_work_from_collab(uuid, text, text, text, text, public.category, uuid[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_work_from_collab(uuid, text, text, text, text, public.category, uuid[], jsonb) TO authenticated;