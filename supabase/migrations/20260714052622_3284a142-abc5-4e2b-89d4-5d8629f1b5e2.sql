
CREATE OR REPLACE FUNCTION public.moderation_normalize_text(_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE t text;
BEGIN
  IF _text IS NULL THEN RETURN ''; END IF;
  t := lower(_text);
  -- strip diacritics (best-effort — Postgres has no unaccent by default in all setups)
  -- basic leetspeak
  t := translate(t, '01345@$', 'oieas as');
  -- remove punctuation / whitespace between letters, collapse to spaces
  t := regexp_replace(t, '[[:punct:]]+', ' ', 'g');
  t := regexp_replace(t, '\s+', ' ', 'g');
  RETURN trim(t);
END; $$;

CREATE OR REPLACE FUNCTION public.moderation_text_is_blocked(_text text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm text;
  hit  int;
BEGIN
  IF _text IS NULL OR length(_text) = 0 THEN RETURN false; END IF;
  norm := ' ' || public.moderation_normalize_text(_text) || ' ';

  SELECT count(*) INTO hit
  FROM public.moderation_terms t
  WHERE t.enabled = true
    AND t.severity = 'block'
    AND t.kind IN ('exact','phrase')
    AND norm ~* ('(^|[^[:alnum:]])' || regexp_replace(lower(t.term), '[^[:alnum:] ]', '', 'g') || '($|[^[:alnum:]])');
  RETURN hit > 0;
END; $$;

REVOKE ALL ON FUNCTION public.moderation_text_is_blocked(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderation_text_is_blocked(text) TO authenticated, service_role;

-- Reusable trigger factory: enforce on a list of fields per table
CREATE OR REPLACE FUNCTION public.enforce_moderation_works()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.moderation_text_is_blocked(NEW.title)
     OR public.moderation_text_is_blocked(NEW.description)
     OR public.moderation_text_is_blocked(NEW.excerpt) THEN
    INSERT INTO public.moderation_events (user_id, surface, subject_id, category, severity)
    VALUES (auth.uid(), 'works.trigger', NEW.id::text, 'slur', 'block');
    RAISE EXCEPTION 'moderation_block: content violates community standards' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_moderate_works ON public.works;
CREATE TRIGGER trg_moderate_works
  BEFORE INSERT OR UPDATE OF title, description, excerpt ON public.works
  FOR EACH ROW EXECUTE FUNCTION public.enforce_moderation_works();

CREATE OR REPLACE FUNCTION public.enforce_moderation_groups()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.moderation_text_is_blocked(NEW.name)
     OR public.moderation_text_is_blocked(NEW.description) THEN
    INSERT INTO public.moderation_events (user_id, surface, subject_id, category, severity)
    VALUES (auth.uid(), 'groups.trigger', NEW.id::text, 'slur', 'block');
    RAISE EXCEPTION 'moderation_block: content violates community standards' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_moderate_groups ON public.groups;
CREATE TRIGGER trg_moderate_groups
  BEFORE INSERT OR UPDATE OF name, description ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.enforce_moderation_groups();

CREATE OR REPLACE FUNCTION public.enforce_moderation_group_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.moderation_text_is_blocked(NEW.title)
     OR public.moderation_text_is_blocked(NEW.description) THEN
    INSERT INTO public.moderation_events (user_id, surface, subject_id, category, severity)
    VALUES (auth.uid(), 'group_events.trigger', NEW.id::text, 'slur', 'block');
    RAISE EXCEPTION 'moderation_block: content violates community standards' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_moderate_group_events ON public.group_events;
CREATE TRIGGER trg_moderate_group_events
  BEFORE INSERT OR UPDATE OF title, description ON public.group_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_moderation_group_events();

CREATE OR REPLACE FUNCTION public.enforce_moderation_profiles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.moderation_text_is_blocked(NEW.display_name)
     OR public.moderation_text_is_blocked(NEW.username)
     OR public.moderation_text_is_blocked(NEW.headline)
     OR public.moderation_text_is_blocked(NEW.bio) THEN
    INSERT INTO public.moderation_events (user_id, surface, subject_id, category, severity)
    VALUES (auth.uid(), 'profiles.trigger', NEW.id::text, 'slur', 'block');
    RAISE EXCEPTION 'moderation_block: content violates community standards' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_moderate_profiles ON public.profiles;
CREATE TRIGGER trg_moderate_profiles
  BEFORE INSERT OR UPDATE OF display_name, username, headline, bio ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_moderation_profiles();

CREATE OR REPLACE FUNCTION public.enforce_moderation_comments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.moderation_text_is_blocked(NEW.body) THEN
    INSERT INTO public.moderation_events (user_id, surface, subject_id, category, severity)
    VALUES (auth.uid(), 'comments.trigger', NEW.id::text, 'slur', 'block');
    RAISE EXCEPTION 'moderation_block: content violates community standards' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_moderate_comments ON public.comments;
CREATE TRIGGER trg_moderate_comments
  BEFORE INSERT OR UPDATE OF body ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_moderation_comments();

CREATE OR REPLACE FUNCTION public.enforce_moderation_messages()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.moderation_text_is_blocked(NEW.body) THEN
    INSERT INTO public.moderation_events (user_id, surface, subject_id, category, severity)
    VALUES (auth.uid(), 'messages.trigger', NEW.id::text, 'slur', 'block');
    RAISE EXCEPTION 'moderation_block: content violates community standards' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_moderate_messages ON public.messages;
CREATE TRIGGER trg_moderate_messages
  BEFORE INSERT OR UPDATE OF body ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_moderation_messages();

DROP TRIGGER IF EXISTS trg_moderate_group_today_posts ON public.group_today_posts;
CREATE OR REPLACE FUNCTION public.enforce_moderation_group_today_posts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.moderation_text_is_blocked(NEW.body) THEN
    INSERT INTO public.moderation_events (user_id, surface, subject_id, category, severity)
    VALUES (auth.uid(), 'group_today_posts.trigger', NEW.id::text, 'slur', 'block');
    RAISE EXCEPTION 'moderation_block: content violates community standards' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_moderate_group_today_posts
  BEFORE INSERT OR UPDATE OF body ON public.group_today_posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_moderation_group_today_posts();

DROP TRIGGER IF EXISTS trg_moderate_instant_messages ON public.instant_messages;
CREATE OR REPLACE FUNCTION public.enforce_moderation_instant_messages()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.moderation_text_is_blocked(NEW.body) THEN
    INSERT INTO public.moderation_events (user_id, surface, subject_id, category, severity)
    VALUES (auth.uid(), 'instant_messages.trigger', NEW.id::text, 'slur', 'block');
    RAISE EXCEPTION 'moderation_block: content violates community standards' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_moderate_instant_messages
  BEFORE INSERT OR UPDATE OF body ON public.instant_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_moderation_instant_messages();

DROP TRIGGER IF EXISTS trg_moderate_workshop_messages ON public.workshop_messages;
CREATE OR REPLACE FUNCTION public.enforce_moderation_workshop_messages()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.moderation_text_is_blocked(NEW.body) THEN
    INSERT INTO public.moderation_events (user_id, surface, subject_id, category, severity)
    VALUES (auth.uid(), 'workshop_messages.trigger', NEW.id::text, 'slur', 'block');
    RAISE EXCEPTION 'moderation_block: content violates community standards' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_moderate_workshop_messages
  BEFORE INSERT OR UPDATE OF body ON public.workshop_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_moderation_workshop_messages();
