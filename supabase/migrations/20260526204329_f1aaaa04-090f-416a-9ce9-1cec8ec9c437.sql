
CREATE OR REPLACE FUNCTION public.tg_workshop_applications_age_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _min int;
  _max int;
  _bd date;
  _age int;
BEGIN
  SELECT min_age, max_age INTO _min, _max FROM public.workshops WHERE id = NEW.workshop_id;
  IF _min IS NULL AND _max IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT birthdate INTO _bd FROM public.profiles WHERE id = NEW.user_id;
  IF _bd IS NULL THEN
    RAISE EXCEPTION 'Add your date of birth on your profile to apply to age-scoped workshops.';
  END IF;

  _age := EXTRACT(YEAR FROM age(_bd))::int;
  IF _min IS NOT NULL AND _age < _min THEN
    RAISE EXCEPTION 'This workshop is for ages % and up.', _min;
  END IF;
  IF _max IS NOT NULL AND _age > _max THEN
    RAISE EXCEPTION 'This workshop is for ages % and under.', _max;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workshop_applications_age_gate ON public.workshop_applications;
CREATE TRIGGER workshop_applications_age_gate
BEFORE INSERT ON public.workshop_applications
FOR EACH ROW EXECUTE FUNCTION public.tg_workshop_applications_age_gate();
