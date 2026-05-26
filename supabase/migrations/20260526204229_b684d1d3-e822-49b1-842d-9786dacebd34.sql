
-- 1. profiles: birthdate + personal age filter
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birthdate date,
  ADD COLUMN IF NOT EXISTS age_filter_min smallint;

-- 2. workshops: optional age scope
ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS min_age smallint,
  ADD COLUMN IF NOT EXISTS max_age smallint,
  ADD COLUMN IF NOT EXISTS hide_from_ineligible boolean NOT NULL DEFAULT false;

-- 3. Privacy: revoke other users' ability to read birthdate / age_filter_min.
--    Self-reads happen through a server function with service-role.
REVOKE SELECT (birthdate, age_filter_min) ON public.profiles FROM anon;
REVOKE SELECT (birthdate, age_filter_min) ON public.profiles FROM authenticated;
REVOKE UPDATE (birthdate) ON public.profiles FROM authenticated;
-- service_role keeps full access for server fns
GRANT SELECT (birthdate, age_filter_min), UPDATE (birthdate, age_filter_min)
  ON public.profiles TO service_role;

-- 4. Security-definer helpers
CREATE OR REPLACE FUNCTION public.user_age(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.birthdate IS NULL THEN NULL
    ELSE EXTRACT(YEAR FROM age(p.birthdate))::int
  END
  FROM public.profiles p
  WHERE p.id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.has_min_age(_user_id uuid, _min int)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.user_age(_user_id) >= _min, false)
$$;

CREATE OR REPLACE FUNCTION public.has_max_age(_user_id uuid, _max int)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.user_age(_user_id) <= _max, false)
$$;

-- 5. Trigger: enforce 13+ floor and lock birthdate once set (admins can override)
CREATE OR REPLACE FUNCTION public.tg_profiles_birthdate_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
BEGIN
  IF NEW.birthdate IS NOT NULL THEN
    IF NEW.birthdate > (CURRENT_DATE - INTERVAL '13 years')::date THEN
      RAISE EXCEPTION 'Workshop is for ages 13 and up.';
    END IF;
    IF NEW.birthdate < DATE '1900-01-01' THEN
      RAISE EXCEPTION 'Please enter a valid date of birth.';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.birthdate IS NOT NULL
     AND NEW.birthdate IS DISTINCT FROM OLD.birthdate
     AND NOT _is_admin THEN
    RAISE EXCEPTION 'Date of birth is locked once set. Contact support to change it.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_birthdate_guard ON public.profiles;
CREATE TRIGGER profiles_birthdate_guard
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_birthdate_guard();

-- 6. Workshop age range sanity trigger
CREATE OR REPLACE FUNCTION public.tg_workshops_age_range_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.min_age IS NOT NULL AND (NEW.min_age < 13 OR NEW.min_age > 120) THEN
    RAISE EXCEPTION 'min_age must be between 13 and 120';
  END IF;
  IF NEW.max_age IS NOT NULL AND (NEW.max_age < 13 OR NEW.max_age > 120) THEN
    RAISE EXCEPTION 'max_age must be between 13 and 120';
  END IF;
  IF NEW.min_age IS NOT NULL AND NEW.max_age IS NOT NULL AND NEW.min_age > NEW.max_age THEN
    RAISE EXCEPTION 'min_age cannot be greater than max_age';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workshops_age_range_guard ON public.workshops;
CREATE TRIGGER workshops_age_range_guard
BEFORE INSERT OR UPDATE ON public.workshops
FOR EACH ROW EXECUTE FUNCTION public.tg_workshops_age_range_guard();
