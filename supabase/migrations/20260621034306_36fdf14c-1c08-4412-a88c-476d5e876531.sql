-- Hot-path composite indexes for scale.

CREATE INDEX IF NOT EXISTS works_public_feed_idx
  ON public.works (published_at DESC NULLS LAST)
  WHERE status = 'published' AND visibility IN ('public', 'unlisted');

CREATE INDEX IF NOT EXISTS collab_posts_open_created_idx
  ON public.collab_posts (created_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS workshops_upcoming_idx
  ON public.workshops (starts_at)
  WHERE status IN ('open', 'check_in', 'active', 'finalizing');

CREATE INDEX IF NOT EXISTS group_events_group_starts_idx
  ON public.group_events (group_id, starts_at);
CREATE INDEX IF NOT EXISTS group_events_starts_idx
  ON public.group_events (starts_at);

CREATE INDEX IF NOT EXISTS follows_follower_idx
  ON public.follows (follower_user_id, followed_user_id);

CREATE INDEX IF NOT EXISTS profiles_lower_username_idx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;