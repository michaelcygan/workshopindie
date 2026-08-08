-- Author/co-author check for a blog post
CREATE OR REPLACE FUNCTION public.is_blog_post_author(_post_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.blog_posts p
      WHERE p.id = _post_id
        AND (p.created_by = _user_id OR p.author_profile_id = _user_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.blog_post_authors a
      WHERE a.blog_post_id = _post_id AND a.profile_id = _user_id
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.blog_post_is_published(_post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blog_posts p
    WHERE p.id = _post_id
      AND p.status = 'published'
      AND p.published_at IS NOT NULL
      AND p.published_at <= now()
  )
$$;

CREATE TABLE public.blog_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_reply text,
  author_reply_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_replied_at timestamptz,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_comments_body_len CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  CONSTRAINT blog_comments_reply_len CHECK (
    author_reply IS NULL OR char_length(btrim(author_reply)) BETWEEN 1 AND 1000
  )
);

CREATE INDEX blog_comments_post_created_idx ON public.blog_comments (blog_post_id, created_at);
CREATE INDEX blog_comments_user_idx ON public.blog_comments (user_id);

GRANT SELECT ON public.blog_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_comments TO authenticated;
GRANT ALL ON public.blog_comments TO service_role;

ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog comments public read"
ON public.blog_comments FOR SELECT TO anon, authenticated
USING (
  public.blog_post_is_published(blog_post_id)
  AND (
    (NOT hidden)
    OR auth.uid() = user_id
    OR public.is_blog_post_author(blog_post_id, auth.uid())
  )
  AND (auth.uid() IS NULL OR NOT public.is_blocked_pair(auth.uid(), user_id))
);

CREATE POLICY "blog comments insert own"
ON public.blog_comments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.blog_post_is_published(blog_post_id)
);

CREATE POLICY "blog comments delete own"
ON public.blog_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "blog comments author moderate"
ON public.blog_comments FOR UPDATE TO authenticated
USING (public.is_blog_post_author(blog_post_id, auth.uid()))
WITH CHECK (public.is_blog_post_author(blog_post_id, auth.uid()));

CREATE POLICY "blog comments admin all"
ON public.blog_comments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.blog_comment_votes (
  comment_id uuid NOT NULL REFERENCES public.blog_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  value smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id),
  CONSTRAINT blog_comment_votes_value_check CHECK (value IN (-1, 1))
);

CREATE INDEX blog_comment_votes_comment_idx ON public.blog_comment_votes (comment_id);
CREATE INDEX blog_comment_votes_user_idx ON public.blog_comment_votes (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_comment_votes TO authenticated;
GRANT ALL ON public.blog_comment_votes TO service_role;

ALTER TABLE public.blog_comment_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog comment votes read own"
ON public.blog_comment_votes FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "blog comment votes insert own"
ON public.blog_comment_votes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "blog comment votes update own"
ON public.blog_comment_votes FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "blog comment votes delete own"
ON public.blog_comment_votes FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Aggregate vote summary: never exposes voter identities
CREATE OR REPLACE FUNCTION public.get_blog_comment_vote_summary(_blog_post_id uuid)
RETURNS TABLE (comment_id uuid, score integer, viewer_vote smallint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS comment_id,
    COALESCE(SUM(v.value), 0)::int AS score,
    MAX(v.value) FILTER (WHERE v.user_id = auth.uid())::smallint AS viewer_vote
  FROM public.blog_comments c
  LEFT JOIN public.blog_comment_votes v ON v.comment_id = c.id
  WHERE c.blog_post_id = _blog_post_id
  GROUP BY c.id
$$;

REVOKE ALL ON FUNCTION public.get_blog_comment_vote_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_blog_comment_vote_summary(uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_blog_post_author(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_blog_post_author(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.blog_post_is_published(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blog_post_is_published(uuid) TO anon, authenticated, service_role;