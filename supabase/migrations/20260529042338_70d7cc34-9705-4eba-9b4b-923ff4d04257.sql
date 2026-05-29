
-- 1. Generic share_events table (separate from existing collab_share_events)
CREATE TABLE public.share_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  channel text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_share_events_entity ON public.share_events(entity_type, entity_id);

GRANT INSERT ON public.share_events TO anon, authenticated;
GRANT SELECT ON public.share_events TO authenticated;
GRANT ALL ON public.share_events TO service_role;

ALTER TABLE public.share_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone logs a share event"
  ON public.share_events FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "owner reads own entity shares"
  ON public.share_events FOR SELECT TO authenticated
  USING (
    (entity_type = 'work' AND EXISTS (SELECT 1 FROM public.works w WHERE w.id = entity_id AND w.created_by = auth.uid()))
    OR (entity_type = 'workshop' AND EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = entity_id AND w.host_user_id = auth.uid()))
    OR (entity_type = 'profile' AND entity_id = auth.uid())
    OR (entity_type = 'collab' AND EXISTS (SELECT 1 FROM public.collab_posts p WHERE p.id = entity_id AND p.user_id = auth.uid()))
  );

CREATE POLICY "admins manage share_events"
  ON public.share_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Referral attribution
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid;
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

CREATE OR REPLACE FUNCTION public.tg_profiles_referral_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
  _username text;
BEGIN
  IF NEW.referred_by IS NULL OR NEW.referred_by = NEW.id THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.referred_by IS NOT DISTINCT FROM NEW.referred_by THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(display_name, username, 'Someone'), username INTO _name, _username
    FROM public.profiles WHERE id = NEW.id;
  INSERT INTO public.notifications (user_id, kind, actor_user_id, entity_type, entity_id, payload)
  VALUES (
    NEW.referred_by,
    'referral_joined',
    NEW.id,
    'profile',
    NEW.id,
    jsonb_build_object('actor_name', _name, 'actor_username', _username)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_referral_notify ON public.profiles;
CREATE TRIGGER profiles_referral_notify
  AFTER INSERT OR UPDATE OF referred_by ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_referral_notify();

-- 3. Work publish celebration: notify followers; first-ever publish also notifies credited collaborators
CREATE OR REPLACE FUNCTION public.tg_works_publish_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_first boolean;
  _author_name text;
  _author_username text;
  _follower_id uuid;
  _collab_user_id uuid;
  _kind text;
BEGIN
  -- Only fire when a work transitions to published
  IF NEW.published_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.published_at IS NOT NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, username, 'Someone'), username
    INTO _author_name, _author_username
    FROM public.profiles WHERE id = NEW.created_by;

  -- Is this the author's first ever published work?
  SELECT NOT EXISTS (
    SELECT 1 FROM public.works
    WHERE created_by = NEW.created_by
      AND id <> NEW.id
      AND published_at IS NOT NULL
  ) INTO _is_first;

  _kind := CASE WHEN _is_first THEN 'first_work_shipped' ELSE 'work_published' END;

  -- Notify followers
  FOR _follower_id IN
    SELECT follower_user_id FROM public.follows WHERE followed_user_id = NEW.created_by
  LOOP
    INSERT INTO public.notifications (user_id, kind, actor_user_id, entity_type, entity_id, payload)
    VALUES (
      _follower_id,
      _kind,
      NEW.created_by,
      'work',
      NEW.id,
      jsonb_build_object(
        'actor_name', _author_name,
        'actor_username', _author_username,
        'title', NEW.title,
        'slug', NEW.slug
      )
    );
  END LOOP;

  -- First-publish only: also notify credited collaborators
  IF _is_first THEN
    FOR _collab_user_id IN
      SELECT DISTINCT user_id FROM public.work_credits
      WHERE work_id = NEW.id AND user_id <> NEW.created_by
    LOOP
      INSERT INTO public.notifications (user_id, kind, actor_user_id, entity_type, entity_id, payload)
      VALUES (
        _collab_user_id,
        'collab_first_ship',
        NEW.created_by,
        'work',
        NEW.id,
        jsonb_build_object(
          'actor_name', _author_name,
          'actor_username', _author_username,
          'title', NEW.title,
          'slug', NEW.slug
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS works_publish_notify ON public.works;
CREATE TRIGGER works_publish_notify
  AFTER INSERT OR UPDATE OF published_at ON public.works
  FOR EACH ROW EXECUTE FUNCTION public.tg_works_publish_notify();
