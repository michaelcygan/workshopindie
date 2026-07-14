
-- 1) Trigger fn: fill works.city_id from creator's home_city_id when null
CREATE OR REPLACE FUNCTION public.tg_works_default_city()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.city_id IS NULL AND NEW.created_by IS NOT NULL THEN
    SELECT home_city_id INTO NEW.city_id
    FROM public.profiles
    WHERE id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS works_default_city ON public.works;
CREATE TRIGGER works_default_city
BEFORE INSERT ON public.works
FOR EACH ROW
EXECUTE FUNCTION public.tg_works_default_city();

-- 2) Backfill existing works
UPDATE public.works w
SET city_id = p.home_city_id
FROM public.profiles p
WHERE w.city_id IS NULL
  AND w.created_by = p.id
  AND p.home_city_id IS NOT NULL;
