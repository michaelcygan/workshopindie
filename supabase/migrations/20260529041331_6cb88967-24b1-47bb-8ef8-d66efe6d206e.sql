-- Add column to track when "workshop starting soon" notifications were sent
ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS starting_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS workshops_starting_notify_idx
  ON public.workshops (starts_at)
  WHERE mode = 'scheduled' AND starting_notified_at IS NULL;

-- Update follow notification trigger to also include actor_username so the
-- notifications bell can deep-link to /u/$username instead of /me.
CREATE OR REPLACE FUNCTION public.tg_follows_notify()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
  _username text;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone'), username
    INTO _name, _username
    FROM public.profiles
    WHERE id = NEW.follower_user_id;
  INSERT INTO public.notifications (user_id, kind, actor_user_id, entity_type, entity_id, payload)
  VALUES (
    NEW.followed_user_id,
    'follow',
    NEW.follower_user_id,
    'profile',
    NEW.follower_user_id,
    jsonb_build_object('actor_name', _name, 'actor_username', _username)
  );
  RETURN NULL;
END;
$$;