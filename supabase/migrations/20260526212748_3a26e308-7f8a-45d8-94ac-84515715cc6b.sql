ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_aliases_chk;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_aliases_chk CHECK (
  coalesce(array_length(aliases, 1), 0) <= 5
);

CREATE OR REPLACE FUNCTION public.tg_profiles_aliases_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE a text;
BEGIN
  IF NEW.aliases IS NULL THEN
    NEW.aliases := '{}';
  END IF;
  FOREACH a IN ARRAY NEW.aliases LOOP
    IF a IS NULL OR length(btrim(a)) < 1 OR length(a) > 40 THEN
      RAISE EXCEPTION 'Each alias must be 1–40 characters.';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_aliases_guard ON public.profiles;
CREATE TRIGGER profiles_aliases_guard
BEFORE INSERT OR UPDATE OF aliases ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_aliases_guard();