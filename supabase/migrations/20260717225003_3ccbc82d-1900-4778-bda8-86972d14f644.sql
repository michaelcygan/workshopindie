ALTER TABLE public.group_today_posts
  ADD CONSTRAINT group_today_posts_author_profile_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.group_today_posts VALIDATE CONSTRAINT group_today_posts_author_profile_fkey;

NOTIFY pgrst, 'reload schema';