-- 1. System group marker -------------------------------------------------
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS system_type text,
  ADD COLUMN IF NOT EXISTS taxonomy_key text;

ALTER TABLE public.groups
  DROP CONSTRAINT IF EXISTS groups_system_type_check;
ALTER TABLE public.groups
  ADD CONSTRAINT groups_system_type_check
  CHECK (system_type IS NULL OR system_type IN ('medium'));

CREATE UNIQUE INDEX IF NOT EXISTS groups_medium_taxonomy_key_uidx
  ON public.groups (taxonomy_key)
  WHERE system_type = 'medium';

-- 2. Membership provenance -------------------------------------------------
ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual';

ALTER TABLE public.group_members
  DROP CONSTRAINT IF EXISTS group_members_source_type_check;
ALTER TABLE public.group_members
  ADD CONSTRAINT group_members_source_type_check
  CHECK (source_type IN ('manual','profile','work','blog','collab','event'));

-- 3. Explicit opt-outs -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_membership_optouts (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

GRANT SELECT, DELETE ON public.group_membership_optouts TO authenticated;
GRANT ALL ON public.group_membership_optouts TO service_role;

ALTER TABLE public.group_membership_optouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own optouts read" ON public.group_membership_optouts;
CREATE POLICY "own optouts read" ON public.group_membership_optouts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own optouts clear" ON public.group_membership_optouts;
CREATE POLICY "own optouts clear" ON public.group_membership_optouts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4. Taxonomy helpers -------------------------------------------------
CREATE OR REPLACE FUNCTION public.canonical_from_storage(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _value
    WHEN 'music' THEN 'music'
    WHEN 'film' THEN 'film_video'
    WHEN 'film_video' THEN 'film_video'
    WHEN 'writing' THEN 'writing'
    WHEN 'writing_book' THEN 'writing'
    WHEN 'visual' THEN 'visual_art'
    WHEN 'visual_art' THEN 'visual_art'
    WHEN 'build' THEN 'games_tech'
    WHEN 'games_tech' THEN 'games_tech'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.medium_group_id(_canonical text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.groups
  WHERE system_type = 'medium'
    AND taxonomy_key = _canonical
    AND deleted_at IS NULL
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.medium_group_id(text) FROM public, anon, authenticated;

-- Adds an automatic membership unless the user opted out or is already a member.
CREATE OR REPLACE FUNCTION public.ensure_medium_membership(_user_id uuid, _canonical text, _source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _gid uuid;
BEGIN
  IF _user_id IS NULL OR _canonical IS NULL THEN RETURN; END IF;
  _gid := public.medium_group_id(_canonical);
  IF _gid IS NULL THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.group_membership_optouts o
             WHERE o.group_id = _gid AND o.user_id = _user_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.group_members (group_id, user_id, role, source_type)
  VALUES (_gid, _user_id, 'member', _source)
  ON CONFLICT (group_id, user_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_medium_membership(uuid, text, text) FROM public, anon, authenticated;

-- 5. Opt-out bookkeeping on join / leave -------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_group_members_optout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id
       AND EXISTS (SELECT 1 FROM public.groups g WHERE g.id = OLD.group_id AND g.system_type IS NOT NULL) THEN
      INSERT INTO public.group_membership_optouts (group_id, user_id)
      VALUES (OLD.group_id, OLD.user_id)
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.source_type = 'manual' THEN
    DELETE FROM public.group_membership_optouts
    WHERE group_id = NEW.group_id AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_group_members_optout ON public.group_members;
CREATE TRIGGER trg_group_members_optout
AFTER INSERT OR DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.tg_group_members_optout();

-- 6. Protect system groups -------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_protect_system_groups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.system_type IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'System groups cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.system_type IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.slug IS DISTINCT FROM OLD.slug
       OR NEW.taxonomy_key IS DISTINCT FROM OLD.taxonomy_key
       OR NEW.system_type IS DISTINCT FROM OLD.system_type
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'System groups cannot be renamed, re-keyed or removed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_system_groups ON public.groups;
CREATE TRIGGER trg_protect_system_groups
BEFORE UPDATE OR DELETE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.tg_protect_system_groups();

-- 7. Seed the five Medium Groups -------------------------------------------------
INSERT INTO public.groups (slug, name, tagline, description, kind, category, visibility, join_mode, is_official, system_type, taxonomy_key)
VALUES
  ('music', 'Music', 'Workshop community for people making music.', 'The open room for everyone on Workshop making music — releases, collaborators, gigs and works in progress.', 'genre', 'music', 'public', 'open', true, 'medium', 'music'),
  ('film-video', 'Film & Video', 'Workshop community for people making film and video.', 'The open room for everyone on Workshop making film and video — shoots, edits, crews and screenings.', 'genre', 'film_video', 'public', 'open', true, 'medium', 'film_video'),
  ('writing', 'Writing', 'Workshop community for people who write.', 'The open room for everyone on Workshop writing — essays, books, scripts and zines.', 'genre', 'writing', 'public', 'open', true, 'medium', 'writing'),
  ('visual-art', 'Visual Art', 'Workshop community for visual artists.', 'The open room for everyone on Workshop making visual art — painting, photography, illustration and design.', 'genre', 'visual_art', 'public', 'open', true, 'medium', 'visual_art'),
  ('games-tech', 'Games & Tech', 'Workshop community for people building games and software.', 'The open room for everyone on Workshop building games, software and hardware.', 'genre', 'games_tech', 'public', 'open', true, 'medium', 'games_tech')
ON CONFLICT (slug) DO UPDATE
  SET system_type = EXCLUDED.system_type,
      taxonomy_key = EXCLUDED.taxonomy_key,
      is_official = true;