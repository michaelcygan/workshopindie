CREATE OR REPLACE FUNCTION public.enforce_username_namespace()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  src text := lower(coalesce(NEW.username, ''));
BEGIN
  IF src = '' THEN
    RETURN NEW;
  END IF;
  IF src = 'applypodcast' THEN
    RAISE EXCEPTION 'That username is reserved.';
  END IF;
  RETURN public_enforce_username_namespace_original(NEW);
END;
$function$;