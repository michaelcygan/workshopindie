CREATE OR REPLACE FUNCTION public.tg_gtp_set_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE _tz text;
BEGIN
  IF NEW.expires_at IS NULL THEN
    SELECT c.timezone INTO _tz
    FROM public.profiles p
    LEFT JOIN public.cities c ON c.id = p.home_city_id
    WHERE p.id = NEW.author_id;
    NEW.expires_at := public.next_local_midnight_utc(COALESCE(NULLIF(_tz, ''), 'UTC'));
  END IF;
  IF NEW.expires_at > now() + INTERVAL '36 hours' THEN
    NEW.expires_at := now() + INTERVAL '36 hours';
  END IF;
  RETURN NEW;
END;
$function$;