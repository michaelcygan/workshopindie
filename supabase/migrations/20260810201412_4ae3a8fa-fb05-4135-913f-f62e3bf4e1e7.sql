CREATE OR REPLACE FUNCTION public.validate_event_subcategory()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _field text;
BEGIN
  IF NEW.subcategory IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.subcategory_field(NEW.subcategory) IS NULL THEN
    RAISE EXCEPTION 'Unknown specialization: %', NEW.subcategory;
  END IF;

  IF NEW.creative_category IS NULL THEN
    RAISE EXCEPTION 'Pick a field before choosing a specialization.';
  END IF;

  _field := public.canonical_category(NEW.creative_category::text);

  IF public.subcategory_field(NEW.subcategory) IS DISTINCT FROM _field THEN
    RAISE EXCEPTION 'That specialization does not belong to the selected field.';
  END IF;

  RETURN NEW;
END;
$function$;