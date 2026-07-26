
CREATE OR REPLACE FUNCTION public.blog_member_publications_this_month(_user_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.blog_posts
  WHERE created_by = _user_id
    AND publication_type = 'member'
    AND status = 'published'
    AND published_at IS NOT NULL
    AND date_trunc('month', published_at AT TIME ZONE 'UTC')
        = date_trunc('month', (now() AT TIME ZONE 'UTC'));
$$;

CREATE OR REPLACE FUNCTION public.try_consume_blog_publication(
  _user_id uuid,
  _post_id uuid,
  _limit int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  used int;
  owner uuid;
  ptype text;
BEGIN
  -- Per-user advisory lock for the duration of the transaction so two
  -- concurrent publishes at 1/2 cannot both slip through.
  PERFORM pg_advisory_xact_lock(hashtext('blog_publish:' || _user_id::text));

  SELECT created_by, publication_type INTO owner, ptype
  FROM public.blog_posts WHERE id = _post_id;

  IF owner IS NULL OR owner <> _user_id THEN
    RAISE EXCEPTION 'not_owner';
  END IF;
  IF ptype <> 'member' THEN
    RAISE EXCEPTION 'not_member_post';
  END IF;

  SELECT COUNT(*)::int INTO used
  FROM public.blog_posts
  WHERE created_by = _user_id
    AND publication_type = 'member'
    AND status = 'published'
    AND published_at IS NOT NULL
    AND date_trunc('month', published_at AT TIME ZONE 'UTC')
        = date_trunc('month', (now() AT TIME ZONE 'UTC'));

  IF used >= _limit THEN
    RETURN false;
  END IF;

  UPDATE public.blog_posts
  SET status = 'published',
      published_at = now(),
      updated_by = _user_id,
      updated_at = now()
  WHERE id = _post_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.blog_member_publications_this_month(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.try_consume_blog_publication(uuid, uuid, int) TO authenticated, service_role;
