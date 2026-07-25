
-- Wave 1: Blog writer access + post distribution flags + member draft creation RPC

-- 1. blog_writer_access table
CREATE TABLE public.blog_writer_access (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('active','suspended','revoked')),
  granted_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at timestamptz NULL,
  expires_at timestamptz NULL,
  note text NULL CHECK (note IS NULL OR char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.blog_writer_access TO authenticated;
GRANT ALL ON public.blog_writer_access TO service_role;

ALTER TABLE public.blog_writer_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_writer_access self read"
  ON public.blog_writer_access FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "blog_writer_access admin all"
  ON public.blog_writer_access FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tg_blog_writer_access_updated
  BEFORE UPDATE ON public.blog_writer_access
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Extend blog_posts with publication_type + show_in_blog_index
ALTER TABLE public.blog_posts
  ADD COLUMN publication_type text NOT NULL DEFAULT 'editorial'
    CHECK (publication_type IN ('editorial','member')),
  ADD COLUMN show_in_blog_index boolean NOT NULL DEFAULT true;

-- Backfill: all existing posts are editorial + indexed (default handles it; explicit for clarity)
UPDATE public.blog_posts SET publication_type = 'editorial', show_in_blog_index = true;

-- Indexes
CREATE INDEX IF NOT EXISTS blog_posts_created_by_updated_idx
  ON public.blog_posts (created_by, status, updated_at DESC)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS blog_posts_index_published_idx
  ON public.blog_posts (show_in_blog_index, status, published_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS blog_post_authors_profile_post_idx
  ON public.blog_post_authors (profile_id, blog_post_id);

-- 3. Atomic member draft creation RPC (service_role-only invocation from server fn)
CREATE OR REPLACE FUNCTION public.create_member_blog_draft(
  _user_id uuid,
  _author_name text
) RETURNS uuid
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
    _user_id, 'member', false
  );

  INSERT INTO public.blog_post_authors (blog_post_id, profile_id, sort_order)
  VALUES (new_id, _user_id, 0);

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_member_blog_draft(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_member_blog_draft(uuid, text) TO service_role;

-- 4. Blog writer access resolver (server-side helper for SQL callers; JS resolver mirrors it)
CREATE OR REPLACE FUNCTION public.blog_writer_access_state(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN 'free'
    -- Suspension always wins
    WHEN EXISTS (
      SELECT 1 FROM public.blog_writer_access
      WHERE user_id = _user_id
        AND status = 'suspended'
        AND (expires_at IS NULL OR expires_at > now())
    ) THEN 'suspended'
    -- Active admin grant
    WHEN EXISTS (
      SELECT 1 FROM public.blog_writer_access
      WHERE user_id = _user_id
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > now())
    ) THEN 'granted'
    -- Active plus (any environment)
    WHEN EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE user_id = _user_id
        AND tier = 'plus'
        AND status = 'active'
        AND (current_period_end IS NULL OR current_period_end > now())
    ) THEN 'plus'
    -- Trialing plus
    WHEN EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE user_id = _user_id
        AND tier = 'plus'
        AND status = 'trialing'
        AND (current_period_end IS NULL OR current_period_end > now())
    ) THEN 'trial'
    -- Lapsed = had a plus subscription before, no longer active/trialing
    WHEN EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE user_id = _user_id
        AND tier = 'plus'
    ) THEN 'lapsed'
    -- Also lapsed if they have any published member posts (so they can still manage them)
    WHEN EXISTS (
      SELECT 1 FROM public.blog_posts
      WHERE created_by = _user_id
        AND publication_type = 'member'
    ) THEN 'lapsed'
    ELSE 'free'
  END;
$$;

GRANT EXECUTE ON FUNCTION public.blog_writer_access_state(uuid) TO authenticated, service_role;

-- 5. Count active member drafts (for trial single-draft limit)
CREATE OR REPLACE FUNCTION public.count_member_active_drafts(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.blog_posts
  WHERE created_by = _user_id
    AND publication_type = 'member'
    AND status = 'draft'
    AND published_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.count_member_active_drafts(uuid) TO authenticated, service_role;
