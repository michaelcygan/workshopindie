ALTER TABLE public.blog_posts
ADD COLUMN author_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX blog_posts_author_profile_id_idx
ON public.blog_posts (author_profile_id)
WHERE author_profile_id IS NOT NULL;

COMMENT ON COLUMN public.blog_posts.author_profile_id IS
'Optional Workshop profile linked from the article byline; author_name remains the display fallback.';