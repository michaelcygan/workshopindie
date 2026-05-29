-- =========================================================
-- Trust & Safety v1: blocks plumbing + automated text moderation
-- =========================================================

CREATE OR REPLACE FUNCTION public.is_blocked_pair(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _a IS NOT NULL AND _b IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_user_id = _a AND blocked_user_id = _b)
       OR (blocker_user_id = _b AND blocked_user_id = _a)
  );
$$;

CREATE OR REPLACE FUNCTION public.blocked_user_ids(_viewer uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT blocked_user_id FROM public.user_blocks WHERE blocker_user_id = _viewer
  UNION
  SELECT blocker_user_id FROM public.user_blocks WHERE blocked_user_id = _viewer;
$$;

CREATE OR REPLACE FUNCTION public.tg_user_blocks_unfollow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.follows
   WHERE (follower_user_id = NEW.blocker_user_id AND followed_user_id = NEW.blocked_user_id)
      OR (follower_user_id = NEW.blocked_user_id AND followed_user_id = NEW.blocker_user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_blocks_unfollow ON public.user_blocks;
CREATE TRIGGER trg_user_blocks_unfollow
AFTER INSERT ON public.user_blocks
FOR EACH ROW EXECUTE FUNCTION public.tg_user_blocks_unfollow();

-- RLS hardening
DROP POLICY IF EXISTS "users follow as themselves" ON public.follows;
CREATE POLICY "users follow as themselves"
  ON public.follows FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = follower_user_id
    AND NOT public.is_blocked_pair(follower_user_id, followed_user_id)
  );

DROP POLICY IF EXISTS "comments public read" ON public.comments;
CREATE POLICY "comments public read"
  ON public.comments FOR SELECT TO anon, authenticated
  USING (
    NOT hidden
    AND (auth.uid() IS NULL OR NOT public.is_blocked_pair(auth.uid(), user_id))
  );

DROP POLICY IF EXISTS "user contacts as self" ON public.collab_contact_events;
CREATE POLICY "user contacts as self"
  ON public.collab_contact_events FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.collab_posts p
       WHERE p.id = collab_post_id
         AND public.is_blocked_pair(auth.uid(), p.user_id)
    )
  );

DROP POLICY IF EXISTS "applicant creates app" ON public.workshop_applications;
CREATE POLICY "applicant creates app"
  ON public.workshop_applications FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.workshops w
       WHERE w.id = workshop_id
         AND public.is_blocked_pair(auth.uid(), w.host_user_id)
    )
  );

-- =========================================================
-- Part 2: Automated text moderation
-- =========================================================

CREATE TABLE IF NOT EXISTS public.moderation_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL UNIQUE,
  severity text NOT NULL DEFAULT 'block' CHECK (severity IN ('block','flag')),
  category text NOT NULL DEFAULT 'hate',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.moderation_terms TO authenticated;
GRANT ALL ON public.moderation_terms TO service_role;

ALTER TABLE public.moderation_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage moderation terms" ON public.moderation_terms;
CREATE POLICY "admins manage moderation terms"
  ON public.moderation_terms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.contains_blocked_term(_text text)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  norm text;
  t record;
  pat text;
BEGIN
  IF _text IS NULL OR length(_text) = 0 THEN RETURN NULL; END IF;
  norm := lower(_text);
  norm := regexp_replace(norm, '[^a-z0-9 ]+', '', 'g');
  norm := regexp_replace(norm, '(.)\1{2,}', '\1\1', 'g');
  FOR t IN SELECT term FROM public.moderation_terms WHERE severity = 'block' LOOP
    pat := regexp_replace(lower(t.term), '[^a-z0-9]', '', 'g');
    IF length(pat) = 0 THEN CONTINUE; END IF;
    IF norm ~ ('\m' || pat || '\M') THEN
      RETURN t.term;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_moderate_text()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  combined text := '';
  i int;
  col text;
  val text;
  hit text;
BEGIN
  FOR i IN 0 .. (TG_NARGS - 1) LOOP
    col := TG_ARGV[i];
    BEGIN
      EXECUTE format('SELECT ($1).%I::text', col) INTO val USING NEW;
    EXCEPTION WHEN OTHERS THEN
      val := NULL;
    END;
    IF val IS NOT NULL THEN
      combined := combined || ' ' || val;
    END IF;
  END LOOP;

  hit := public.contains_blocked_term(combined);
  IF hit IS NOT NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Your post contains language we don''t allow. Please revise and try again.',
      ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_moderate_works ON public.works;
CREATE TRIGGER trg_moderate_works
BEFORE INSERT OR UPDATE OF title, description ON public.works
FOR EACH ROW EXECUTE FUNCTION public.tg_moderate_text('title', 'description');

DROP TRIGGER IF EXISTS trg_moderate_collab_posts ON public.collab_posts;
CREATE TRIGGER trg_moderate_collab_posts
BEFORE INSERT OR UPDATE OF title, description ON public.collab_posts
FOR EACH ROW EXECUTE FUNCTION public.tg_moderate_text('title', 'description');

DROP TRIGGER IF EXISTS trg_moderate_collab_roles ON public.collab_roles;
CREATE TRIGGER trg_moderate_collab_roles
BEFORE INSERT OR UPDATE OF role_name, description ON public.collab_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_moderate_text('role_name', 'description');

DROP TRIGGER IF EXISTS trg_moderate_workshops ON public.workshops;
CREATE TRIGGER trg_moderate_workshops
BEFORE INSERT OR UPDATE OF title, prompt ON public.workshops
FOR EACH ROW EXECUTE FUNCTION public.tg_moderate_text('title', 'prompt');

DROP TRIGGER IF EXISTS trg_moderate_comments ON public.comments;
CREATE TRIGGER trg_moderate_comments
BEFORE INSERT OR UPDATE OF body ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.tg_moderate_text('body');

DROP TRIGGER IF EXISTS trg_moderate_messages ON public.messages;
CREATE TRIGGER trg_moderate_messages
BEFORE INSERT OR UPDATE OF body ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.tg_moderate_text('body');

DROP TRIGGER IF EXISTS trg_moderate_profiles ON public.profiles;
CREATE TRIGGER trg_moderate_profiles
BEFORE INSERT OR UPDATE OF display_name, bio, headline, aliases, instagram_handle, username
ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_moderate_text(
  'display_name','bio','headline','aliases','instagram_handle','username'
);

INSERT INTO public.moderation_terms (term, severity, category) VALUES
  ('nigger','block','slur'),
  ('nigga','block','slur'),
  ('faggot','block','slur'),
  ('fag','block','slur'),
  ('dyke','block','slur'),
  ('tranny','block','slur'),
  ('kike','block','slur'),
  ('chink','block','slur'),
  ('gook','block','slur'),
  ('spic','block','slur'),
  ('wetback','block','slur'),
  ('coon','block','slur'),
  ('retard','block','slur'),
  ('retarded','block','slur'),
  ('heil hitler','block','hate'),
  ('sieg heil','block','hate'),
  ('white power','block','hate'),
  ('kill all jews','block','hate'),
  ('kill all blacks','block','hate'),
  ('kill all whites','block','hate')
ON CONFLICT (term) DO NOTHING;