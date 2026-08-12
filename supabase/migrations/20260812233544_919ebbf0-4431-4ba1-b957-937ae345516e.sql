-- 1) Tag the existing language group
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_system_type_check;
ALTER TABLE public.groups ADD CONSTRAINT groups_system_type_check
  CHECK (system_type IS NULL OR system_type IN ('medium', 'language'));

UPDATE public.groups
SET system_type = 'language', taxonomy_key = 'es'
WHERE id = '98bf88b7-f6ce-46ac-a086-bc3b67f2e8de';

-- 2) Lookup helper
CREATE OR REPLACE FUNCTION public.language_group_id(_key text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.groups
  WHERE system_type = 'language'
    AND taxonomy_key = _key
    AND deleted_at IS NULL
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.language_group_id(text) FROM PUBLIC, anon, authenticated;

-- 3) Normalize a stored language label to a canonical key
CREATE OR REPLACE FUNCTION public.language_key(_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE lower(btrim(coalesce(_raw, '')))
    WHEN 'english' THEN 'en'
    WHEN 'en' THEN 'en'
    WHEN 'inglés' THEN 'en'
    WHEN 'ingles' THEN 'en'
    WHEN 'spanish' THEN 'es'
    WHEN 'es' THEN 'es'
    WHEN 'español' THEN 'es'
    WHEN 'espanol' THEN 'es'
    WHEN 'castellano' THEN 'es'
    ELSE NULL
  END
$$;
REVOKE ALL ON FUNCTION public.language_key(text) FROM PUBLIC, anon, authenticated;

-- 4) Sync memberships from profiles.languages
CREATE OR REPLACE FUNCTION public.sync_profile_language_groups(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _langs text[];
  _l text;
  _key text;
  _gid uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  SELECT languages::text[] INTO _langs FROM public.profiles WHERE id = _user_id;
  IF _langs IS NULL THEN RETURN; END IF;

  FOREACH _l IN ARRAY _langs LOOP
    _key := public.language_key(_l);
    CONTINUE WHEN _key IS NULL;
    _gid := public.language_group_id(_key);
    CONTINUE WHEN _gid IS NULL;
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.group_membership_optouts o
      WHERE o.group_id = _gid AND o.user_id = _user_id
    );
    INSERT INTO public.group_members (group_id, user_id, role, source_type)
    VALUES (_gid, _user_id, 'member', 'profile')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_profile_language_groups(uuid) FROM PUBLIC, anon, authenticated;

-- 5) Trigger
CREATE OR REPLACE FUNCTION public.tg_profiles_language_groups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.sync_profile_language_groups(NEW.id);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_profiles_language_groups() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_language_groups ON public.profiles;
CREATE TRIGGER profiles_language_groups
AFTER INSERT OR UPDATE OF languages ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_language_groups();

-- 6) Backfill: canonicalize stored labels, drop unsupported entries
UPDATE public.profiles p
SET languages = COALESCE((
  SELECT array_agg(DISTINCT CASE public.language_key(x) WHEN 'en' THEN 'English' ELSE 'Español' END)
  FROM unnest(p.languages::text[]) AS x
  WHERE public.language_key(x) IS NOT NULL
), '{}'::text[])
WHERE p.languages IS NOT NULL
  AND array_length(p.languages, 1) > 0;

-- 7) Backfill memberships
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE languages IS NOT NULL AND array_length(languages, 1) > 0 LOOP
    PERFORM public.sync_profile_language_groups(r.id);
  END LOOP;
END $$;