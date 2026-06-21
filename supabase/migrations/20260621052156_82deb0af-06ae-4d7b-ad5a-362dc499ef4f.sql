-- Raise birthdate floor from 13 to 18 and add deletion request column
CREATE OR REPLACE FUNCTION public.tg_profiles_birthdate_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
BEGIN
  IF NEW.birthdate IS NOT NULL THEN
    IF NEW.birthdate > (CURRENT_DATE - INTERVAL '18 years')::date THEN
      RAISE EXCEPTION 'Workshop is an 18+ product.';
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
$function$;

-- Adult helper
CREATE OR REPLACE FUNCTION public.is_adult(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(public.user_age(_user_id) >= 18, false)
$function$;

-- Soft-delete column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;

GRANT SELECT (deletion_requested_at), UPDATE (deletion_requested_at)
  ON public.profiles TO authenticated;