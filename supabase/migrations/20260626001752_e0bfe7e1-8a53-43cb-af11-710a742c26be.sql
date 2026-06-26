
-- Indexes for scale
CREATE INDEX IF NOT EXISTS group_today_posts_group_expires_idx
  ON public.group_today_posts (group_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS group_today_pins_group_expires_idx
  ON public.group_today_pins (group_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS group_events_group_starts_idx
  ON public.group_events (group_id, starts_at);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- Rate limit Today chat posts
CREATE OR REPLACE FUNCTION public.tg_group_today_posts_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INT;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.group_today_posts
  WHERE author_id = NEW.author_id
    AND group_id = NEW.group_id
    AND created_at > now() - interval '10 seconds';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Slow down — too many messages. Try again in a moment.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_group_today_posts_rate_limit ON public.group_today_posts;
CREATE TRIGGER tg_group_today_posts_rate_limit
  BEFORE INSERT ON public.group_today_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_group_today_posts_rate_limit();
