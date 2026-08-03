CREATE OR REPLACE FUNCTION public.create_member_blog_draft(_user_id uuid, _author_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid := gen_random_uuid();
  new_slug text := 'draft-' || replace(new_id::text, '-', '');
BEGIN
  INSERT INTO public.blog_posts (
    id, title, slug, excerpt, body_markdown,
    status, author_name, created_by, updated_by,
    author_profile_id, publication_type, show_in_blog_index
  ) VALUES (
    new_id, 'Untitled', new_slug, '', '',
    'draft', _author_name, _user_id, _user_id,
    _user_id, 'member', true
  );

  INSERT INTO public.blog_post_authors (blog_post_id, profile_id, sort_order)
  VALUES (new_id, _user_id, 0);

  RETURN new_id;
END;
$$;